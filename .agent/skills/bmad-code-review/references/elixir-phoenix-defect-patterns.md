# Elixir / Phoenix Defect Patterns

Reference catalog of recurring issues found in Elixir/Phoenix code reviews, complementing the TypeScript-specific patterns in `common-defect-patterns.md`.

## Application Boot & Supervision Tree

### Supervised dependency not added to children list
**Severity:** HIGH
**Pattern:** A library (e.g., Oban, Hammer, Cachex, Redix) is added to `mix.exs` deps but never started in the `application.ex` supervision tree. The app compiles and tests pass, but production never initializes the service, leading to silent failures (e.g., Oban jobs never picked up, cache lookups always miss).
**Detection:** In `lib/<app>/application.ex`, cross-reference every runtime/infra dependency in `mix.exs` against the `children` list. Any dependency whose README says "add to your supervision tree" but is missing = CRITICAL finding.
**Fix:**
```elixir
def start(_type, _args) do
  children = [
    {Cachex, name: :my_cache},
    {Oban, Application.fetch_env!(:my_app, Oban)[:setup]},
  ]
  Supervisor.start_link(children, strategy: :one_for_one, name: MyApp.Supervisor)
end
```
If intentionally deferred, record the deferral in the story doc so the oversight isn't permanent.

## Configuration

### OTP app config namespace mismatch
**Severity:** HIGH
**Pattern:** A hex library reads its config via `Application.get_env(:library_name, key)` but the project stores config under the top-level OTP app name (e.g., `:leadforge_ai`) instead of `:library_name`. At runtime the library gets `nil` defaults even though `config/runtime.exs` appears correct.
**Example:**
```elixir
config :leadforge_ai, :meilisearch, host: "http://localhost:7700", api_key: nil
# Library internally reads from :meilisearch (expected by the hex package)
Application.get_env(:meilisearch, key, default)  # -> returns default, not runtime.exs value
```
**Fix:**
```elixir
config :meilisearch,
  endpoint: System.get_env("MEILISEARCH_HOST", "http://localhost:7700"),
  api_key: System.get_env("MEILISEARCH_API_KEY", nil)
```
### Partial Redis / infra wiring without client dependency
**Severity:** MEDIUM
**Pattern:** Docker Compose starts Redis and `config/runtime.exs` captures `REDIS_URL`, but no Redis client (e.g., `:redix`) is listed in `mix.exs`. The infrastructure is present, but the application can never connect.
**Fix:** Add `:redix` to `mix.exs`, add connection config to `runtime.exs`, and add the child to the supervision tree.

### Missing env var fallbacks in `runtime.exs`
**Severity:** MEDIUM
**Pattern:** A service URL or API key is read from `System.get_env/1` without a default. In development or CI the app crashes at boot with a cryptic `nil` error deep in the library stack.
**Fix:** Use `System.get_env("VAR", "default")` for non-secrets; for secrets, crash loudly with `raise` if absent rather than letting the library swallow it.

## Database / Migrations

### Default primary key type mismatch (UUID vs bigserial)
**Severity:** LOW (scaffold-level) / HIGH (post-data)
**Pattern:** `phx.new` defaults to `bigserial` primary keys. If the architecture calls for UUIDs or `--binary-id`, forgetting to pass `--binary-id` at scaffold time means all migrations use `bigserial`. Retrofitting UUIDs after tables exist is painful.
**Fix:** Configure repo-level `migration_primary_key` before first create-table migration:
```elixir
config :my_app, MyApp.Repo,
  migration_primary_key: [name: :id, type: :binary_id, autogenerate: true],
  migration_timestamps: [type: :utc_datetime_usec]
```

## Assets & Frontend

### Tailwind v4 CSS-first config misalignment
**Severity:** LOW
**Pattern:** Phoenix 1.8+ uses Tailwind v4 CSS-first (`@import "tailwindcss"` in `app.css`) and removed `tailwind.config.js`. Developers used to v3 may create old config files or use `@tailwind` directives that fail in v4.
**Detection:**
1. `assets/css/app.css` uses `@import "tailwindcss"` (not `@tailwind` directives)
2. No `tailwind.config.js` exists in `assets/`
3. `assets/js/app.js` uses `phoenix-colocated` import shorthand

### Missing live-reload patterns in `config/dev.exs`
**Severity:** LOW
**Pattern:** Generated `dev.exs` only watches `lib/` and `assets/`. New asset classes (locale files, markdown artifacts) won't trigger livereload.
**Fix:** Add extra watcher patterns when new asset directories are introduced.

## Testing

### Stale red-phase scaffolds with `@moduletag :skip`
**Severity:** MEDIUM
**Pattern:** ATDD test scaffolds generated during the red phase retain `@moduletag :skip` after the story is fully implemented. Over time these skipped tests accumulate and mislead reviewers about actual coverage. In Elixir this is common with `phx.gen.auth` because the generator produces its own test suite; the original red-phase scaffolds become redundant.
**Detection:**
1. Search `grep -r "@moduletag :skip\|@tag :skip" test/` for scaffolds related to implemented stories.
2. Cross-reference skip-tagged test files against the story status in `sprint-status.yaml` or the story `.md` file.
3. If the story status is `completed` and the scaffold still skips all tests, flag it for removal or activation.
**Fix:** Activate by removing `@moduletag :skip`, or delete the file if the generated tests already cover the same paths.

## PostgreSQL Row-Level Security (RLS)

When a Phoenix/Ecto project uses PostgreSQL RLS (`CREATE POLICY`, `FORCE ROW LEVEL SECURITY`) for tenant isolation, the database enforces access control regardless of application code. This creates a distinct class of defects: application code that "looks correct" but is silently blocked by the DB, or RLS setup that creates security holes.

### SQL injection via string interpolation in SET LOCAL
**Severity:** CRITICAL
**Pattern:** `Repo.query!("SET LOCAL app.current_user_id = '#{user_id}'")` uses string interpolation to build SQL. Even though `user_id` is usually a bigint, if the wrapper accepts any map with an `id` key, an attacker could pass a crafted id containing SQL metacharacters.
**Fix:** PostgreSQL `SET LOCAL` does **not** support parameter placeholders (`$1`). Use strict runtime validation of the user ID before interpolation, and remove any `reset_user/0` helper (see M1 below):
```elixir
defp validate_user_id!(user_id) when is_integer(user_id) and user_id > 0, do: user_id
defp validate_user_id!(user_id) when is_binary(user_id) do
  case Integer.parse(user_id) do
    {int, ""} when int > 0 -> int
    _ -> raise ArgumentError, "Invalid user_id: #{inspect(user_id)}"
  end
end
defp validate_user_id!(other), do: raise ArgumentError, "Invalid user_id: #{inspect(other)}"

Repo.query!("SET LOCAL app.current_user_id = #{validate_user_id!(user_id)}")
```

### Unwrapped Repo queries bypass RLS in production
**Severity:** CRITICAL
**Pattern:** Context functions call `Repo.get/2`, `Repo.all/1`, `Repo.update/2`, `Repo.delete/2`, or `Repo.exists?/1` directly without wrapping in the RLS transaction helper (e.g., `Repo.Rls.with_user/2`). With `FORCE ROW LEVEL SECURITY` enabled and a non-superuser DB role, these queries silently return zero rows, or `update/delete` appear to succeed (returning `{:ok, _}`) while changing nothing because the policy filtered out the target row.
**Detection:**
1. Identify the RLS wrapper module (e.g., `Repo.Rls`).
2. `grep -rn "Repo\.\(get\|all\|update\|delete\|insert\|exists\?\)" lib/<app>/` and check if each tenant-scoped call is inside a `with_user/2` block.
3. Any tenant-scoped query outside the wrapper = CRITICAL finding.
**Fix:** Wrap all tenant-scoped queries, or redesign context functions to accept `user` and wrap internally:
```elixir
Repo.Rls.with_user(user, fn ->
  Repo.all(Workspace)
end)
```

### RLS pre-check functions always return false
**Severity:** HIGH
**Pattern:** A `slug_taken?/1` or similar pre-existence check runs an unwrapped `Repo.exists?/1` query. With `FORCE RLS` and no `app.current_user_id` set, the policy returns zero rows, so the check always returns `false`. The "retry with random suffix" logic never triggers; the actual insert then hits the DB unique constraint, aborting the savepoint and returning a raw error to the user.
**Fix:** Move the pre-check inside the `Rls.with_user/2` block, or remove it and rely on the changeset `unique_constraint` validation.

### Session-scoped RESET outside transaction on pooled connections
**Severity:** MEDIUM
**Pattern:** A `reset_user/0` helper calls `Repo.query!("RESET app.current_user_id")` outside a transaction. `RESET` is session-scoped, not `SET LOCAL` (which auto-clears at transaction end). On a connection pool, this resets the variable for the next request that reuses the connection, causing transient RLS bypass or cross-tenant data leaks.
**Fix:** Remove `reset_user/0` entirely — `SET LOCAL` already clears at transaction end. If a manual reset is absolutely required, wrap it in `Repo.transaction`.

### RLS policy blocks legitimate cross-user inserts
**Severity:** CRITICAL
**Pattern:** An RLS policy enforces `user_id = current_setting('app.current_user_id')` on ALL operations (both `USING` and implicit `WITH CHECK`). When a workspace owner invites an existing user, the INSERT row has `user_id = invitee_id`, not the owner's id. RLS blocks the legitimate insert.
**Fix:** Split the policy into separate `USING` (self-select) and `WITH CHECK` (workspace-owner-can-insert) clauses:
```sql
CREATE POLICY membership_select ON workspace_memberships
  FOR SELECT USING (user_id = current_setting('app.current_user_id')::bigint);

CREATE POLICY membership_insert_by_owner ON workspace_memberships
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM workspaces w
            WHERE w.id = workspace_memberships.workspace_id
            AND w.owner_id = current_setting('app.current_user_id')::bigint)
  );
```

### RLS tests commented out due to sandbox nested-transaction isolation
**Severity:** HIGH
**Pattern:** `Ecto.Adapters.SQL.Sandbox` wraps each test in a transaction. `Repo.Rls.with_user/2` opens a nested transaction (savepoint). `SET LOCAL` inside the savepoint is invisible to the outer savepoint's queries. Setup data inserted before `with_user/2` cannot be seen by RLS-scoped queries inside it. Developers comment out entire test files.
**Detection:**
1. Check if the test DB user is a superuser: `SELECT rolsuper FROM pg_roles WHERE rolname = current_user()`. If `t`, the user unconditionally bypasses RLS even with `FORCE ROW LEVEL SECURITY`.
2. If the user is a superuser, RLS tests cannot verify DB-layer isolation in this environment. The tests should be `@moduletag :skip` with an explanatory `@moduledoc`.
3. If the user is NOT a superuser, use direct `Repo.query!("SET LOCAL app.current_user_id = $1", [user.id])` in test setup. Sandbox already wraps the whole test in a transaction, so `SET LOCAL` applies test-wide without nesting:
```elixir
setup %{user: user} do
  Repo.query!("SET LOCAL app.current_user_id = $1", [user.id])
  :ok
end
```
4. Never call `Repo.Rls.with_user/2` inside test setup — it opens a nested savepoint and hides setup data.

**Fix:** If superuser: mark RLS test files `@moduletag :skip` with documentation. If non-superuser: use direct `SET LOCAL` in setup, or use `Ecto.Adapters.SQL.Sandbox.mode(:manual)` to avoid wrapping.

### RLS-unwrapped query + UUID/slug redirect mismatch
**Severity:** CRITICAL
**Pattern:** After `accept_invitation` succeeds, the controller calls an unwrapped `get_workspace!/1` (single-arity, no user) to get the redirect target. RLS blocks it, raising `Ecto.NoResultsError`. The rescue path falls back to redirecting to `/workspaces/#{invitation.workspace_id}` — a UUID. The `show/2` action expects a slug and calls `get_workspace!/2` with the slug, so the UUID route 404s. This is a compound failure: RLS bypass + UUID/slug mismatch.
**Fix:** Preload the workspace slug before redirecting, or look up the workspace inside an RLS wrapper:
```elixir
case Workspaces.accept_invitation(token, user) do
  {:ok, invitation} ->
    workspace = Repo.Rls.with_user(user, fn ->
      Workspaces.get_workspace!(invitation.workspace_id)
    end)
    redirect(conn, to: ~p"/workspaces/#{workspace.slug}")
end
```

## Multi-Tenancy Verification Patterns
**Severity:** HIGH
**Pattern:** Tests pass because they mock or bypass the supervision tree, but `mix phx.server` crashes because a dependency is supervised incorrectly in `application.ex`. Example: adding Oban to deps but not to children.
**Fix:** Always run a boot smoke test (`mix phx.server` or `mix run --no-halt`) during code review, even if `mix test` is green.

## Phoenix-Specific Security

### LiveView vs Controller expectation drift (Phoenix 1.8)
**Severity:** MEDIUM
**Pattern:** Developers expect `phx.gen.auth` to generate LiveViews (`UserRegistrationLive`, `UserLoginLive`, etc.) because the app was scaffolded with `--live`. In Phoenix 1.8, `phx.gen.auth` generates controllers for registration, session, and settings regardless. ATDD scaffolds and story docs that reference LiveView modules become stale, and tests referencing nonexistent LiveViews (e.g. `user_registration_live_test.exs`) compile-fail or mislead reviewers.
**Detection:**
1. After running `phx.gen.auth`, check `lib/<app>_web/controllers/` for `user_*_controller.ex` files (should exist).
2. Check `lib/<app>_web/live/` — no auth LiveViews generated.
3. Review ATDD scaffolds in `test/<app>_web/live/` that reference `UserRegistrationLive`, `UserConfirmLive`, etc. — these are invalid.
**Fix:** Update story docs to document controller-based auth. Remove or annotate stale LiveView ATDD scaffolds. Add controller-based tests in `test/<app>_web/controllers/` instead.

### Secure flag missing on remember-me cookie in production
**Severity:** MEDIUM
**Pattern:** Phoenix-generated `user_auth.ex` sets up the remember-me cookie with `same_site: "Lax"` and `sign: true`, but does not conditionally add `secure: true` when the app is served over HTTPS. In production behind an SSL terminator or direct HTTPS, cookies are sent over unencrypted connections.
**Detection:** In `lib/<app>_web/user_auth.ex`, inspect the cookie options passed to `put_resp_cookie/3`. Look for `@remember_me_options` — if `secure: true` is absent, flag it.
**Fix:**
Env-aware `secure` flag driven by app config:
```elixir
# lib/my_app_web/user_auth.ex
options = Keyword.merge(@remember_me_options,
  secure: Application.get_env(:my_app, :secure_cookie, false)
)
put_resp_cookie(conn, @remember_me_cookie, token, options)
```

```elixir
# config/prod.exs
config :my_app, :secure_cookie, true
```

For a single-environment fix, read the endpoint scheme:
```elixir
# In config/runtime.exs or inside cookie-opts construction
secure = Phoenix.Endpoint.config(:my_app, MyAppWeb.Endpoint)[:url][:scheme] == "https"
```
Alternatively, document in the deploy checklist that SSL termination handles cookie security.

### Missing `http_only` on session cookie
**Severity:** MEDIUM
**Pattern:** Phoenix `Endpoint` configures `@session_options` with `store: :cookie`, but `http_only: true` is omitted. The session cookie becomes readable by JavaScript via `document.cookie`, increasing XSS impact if an attacker injects a script.
**Detection:** In `lib/<app>_web/endpoint.ex`, inspect the `@session_options` module attribute. Confirm `http_only: true` is present alongside `same_site` and `sign`.
**Fix:** Add `http_only: true` to the session options:
```elixir
@session_options [
  store: :cookie,
  key: "_my_app_session",
  signing_salt: "salt",
  same_site: "Lax",
  http_only: true
]
```

### Missing rate limiter on auth and session routes
**Severity:** MEDIUM
**Pattern:** Auth routes (`/users/register`, `/users/log-in`, `/users/reset_password`, `/users/settings`) have no request-rate cap. Brute-force login and registration enumeration are possible.
**Detection:** Inspect `lib/<app>_web/router.ex`. Look for a `:rate_limit` pipeline or plug applied to auth scopes. Absence = finding.
**Fix:** Implement a lightweight fixed-window plug and apply it to auth scopes:
```elixir
# lib/my_app_web/plugs/rate_limiter.ex
defmodule MyAppWeb.Plugs.RateLimiter do
  @moduledoc "Fixed-window rate limiter backed by Cachex."
  import Plug.Conn
  @default_window 60_000
  @default_max 10

  def init(opts), do: opts

  def call(conn, _opts) do
    if Application.get_env(:my_app, __MODULE__)[:enabled] == false do
      conn
    else
      key = "rate_limit:#{conn.remote_ip}:#{conn.request_path}"
      count = Cachex.get!(:my_cache, key) || 0
      if count >= @default_max do
        conn |> put_status(429) |> send_resp(429, "Too Many Requests.") |> halt()
      else
        Cachex.put(:my_cache, key, count + 1, ttl: :timer.milliseconds(@default_window))
        conn
      end
    end
  end
end
```

In `router.ex`:
```elixir
pipeline :rate_limit do
  plug MyAppWeb.Plugs.RateLimiter
end

scope "/users" do
  pipe_through [:browser, :rate_limit]
  # auth routes...
end
```

And disable in `config/test.exs` to avoid throttling tests:
```elixir
config :my_app, MyAppWeb.Plugs.RateLimiter, enabled: false
```

### LiveDashboard exposed outside `:dev_routes`
**Severity:** MEDIUM
**Pattern:** `Phoenix.LiveDashboard` mounted in `router.ex` without gating behind `Application.compile_env(:my_app, :dev_routes)`. In production, exposes BEAM introspection.
**Fix:** Always gate LiveDashboard:
```elixir
if Application.compile_env(:my_app, :dev_routes) do
  import Phoenix.LiveDashboard.Router
  live_dashboard "/dashboard"
end
```

### Missing `check_origin` in production
**Severity:** MEDIUM
**Pattern:** WebSocket endpoints without explicit `check_origin` allow CSWSH.
**Fix:** Add `check_origin: ["https://myapp.com"]` in `config/runtime.exs` for `:prod`.

## Workspace Multi-Tenancy & RBAC

### Unwrapped transaction + silent membership failure
**Severity:** CRITICAL
**Pattern:** `Workspaces.create_workspace/2` inserts a workspace via `Repo.insert`, then calls `create_owner_membership/2` outside any transaction. If the membership insert fails, the workspace is already committed and becomes orphaned with no owner. Worse, `create_owner_membership` does a bare `Repo.insert()` without matching the result — failures are silently discarded.
**Detection Checklist:**
1. Look for workspace/tenant creation functions that insert a parent record followed by a child membership/ACL row.
2. Verify if both inserts are wrapped in `Repo.transaction/1` or `Repo.transact/1`.
3. Verify the child insert result is matched (`|> Repo.insert()` alone is a leak).
**Fix:** Wrap both inserts in a transaction:
```elixir
def create_workspace(%User{} = user, attrs) do
  Repo.transaction(fn ->
    {:ok, workspace} = Workspace.changeset(%Workspace{}, Map.put(attrs, "owner_id", user.id))
                       |> Repo.insert()
    {:ok, _} = %WorkspaceMembership{}
               |> WorkspaceMembership.changeset(%{workspace_id: workspace.id, user_id: user.id, role: "owner"})
               |> Repo.insert()
    workspace
  end)
end
```

### Dead authorization plug — defined but unwired
**Severity:** CRITICAL
**Pattern:** A `RequireWorkspaceRole` plug (or similar RBAC plug) is correctly implemented with role hierarchy (`owner > admin > member > viewer`) and `halt_with_forbidden/2`, but no routes in `router.ex` actually pipe through it. Every authenticated user can hit update/delete/invite endpoints regardless of role.
**Detection:**
1. Search `router.ex` for usages of the plug module name.
2. If zero hits outside `defmodule`, the RBAC is dead code.
**Fix:** Apply the plug to the appropriate scopes:
```elixir
pipeline :workspace_owner do
  plug LeadforgeAiWeb.Plugs.RequireWorkspaceRole, roles: [:owner, :admin]
end

scope "/", LeadforgeAiWeb do
  pipe_through [:browser, :require_authenticated_user, :workspace, :workspace_owner]
  resources "/workspaces", WorkspaceController, only: [:update, :delete] do
    post "/invite", WorkspaceController, :invite
  end
end
```

### UUID vs slug redirect mismatch after invitation acceptance
**Severity:** CRITICAL
**Pattern:** `accept_invitation` succeeds and redirects to `~p"/workspaces/#{invitation.workspace_id}"` (a UUID), but `WorkspaceController.show/2` expects a slug and calls `get_workspace!(user, slug)`. `Ecto.NoResultsError` is raised because the lookup is by slug, not UUID.
**Detection:**
1. Search invitation acceptance handlers for redirect targets containing `.workspace_id`.
2. Verify that the receiving controller action matches by UUID or preloads the slug.
**Fix:** Preload workspace slug, or overload `get_workspace!` to accept both:
```elixir
def accept_invitation(conn, %{"token" => token}) do
  case Workspaces.accept_invitation(token, conn.assigns.current_scope.user) do
    {:ok, invitation} ->
      workspace = Workspaces.get_workspace!(invitation.workspace_id)
      conn
      |> put_flash(:info, "You have joined the workspace.")
      |> redirect(to: ~p"/workspaces/#{workspace.slug}")
    # ...
  end
end
```

### MatchError crash on duplicate membership in transaction
**Severity:** CRITICAL
**Pattern:** Inside a `Repo.transact` callback, a membership insert uses strict match `{:ok, _} = Repo.insert(changeset)`. If the user is already a member (unique constraint violation), the transaction raises `MatchError` instead of returning `{:error, changeset}` cleanly. The caller gets a 500 instead of a controlled error response.
**Fix:** Return the result, don't force-match:
```elixir
Repo.transact(fn ->
  invitation = Repo.get_by!(WorkspaceInvitation, token: token)
  if invitation.accepted_at, do: throw({:error, :already_accepted})

  case %WorkspaceMembership{}
       |> WorkspaceMembership.changeset(%{workspace_id: invitation.workspace_id, user_id: user.id, role: invitation.role})
       |> Repo.insert() do
    {:ok, _} ->
t      invitation
      |> WorkspaceInvitation.changeset(%{accepted_at: DateTime.utc_now()})
      |> Repo.update()

    {:error, changeset} ->
      Repo.rollback(changeset)
  end
end)
```

### Missing email ownership check on invitation acceptance
**Severity:** HIGH
**Pattern:** Any authenticated user who knows the invitation token can accept an invitation intended for a different email address. The system never asserts `user.email == invitation.email`.
**Fix:** Add an ownership check before the transaction:
```elixir
def accept_invitation(token, %User{email: email} = user) do
  invitation = Repo.get_by!(WorkspaceInvitation, token: token)
  if invitation.email != email do
    {:error, :email_mismatch}
  else
    # proceed with transact...
  end
end
```

### Missing duplicate-member guard before membership insert
**Severity:** HIGH
**Pattern:** `Workspaces.add_member/2` attempts to insert a membership for a user who is already a member. The unique constraint in the database catches it, but the raw DB error bubbles up as a 500 or unhandled changeset instead of a clean "already a member" response.
**Fix:** Check for existing membership early:
```elixir
if Workspaces.get_membership(workspace.id, user.id) do
  {:error, :already_member}
else
  # proceed with insert...
end
```

### Controller double-fetch (plug + action both query workspace)
**Severity:** MEDIUM
**Pattern:** `FetchCurrentWorkspace` plug loads the workspace from path or session and assigns it to `conn.assigns.current_workspace`. The controller action immediately re-fetches with `get_workspace!(conn.assigns.current_scope.user, slug)`. This queries the same row twice per request.
**Fix:** Reuse the plug assignment:
```elixir
def show(conn, %{"id" => _slug}) do
  workspace = conn.assigns.current_workspace || raise "Workspace not loaded"
  render(conn, :show, workspace: workspace)
end
```
Or remove the plug from routes where the controller handles its own lookup.

### Stale red-phase scaffolds with `@moduletag :skip`
**Severity:** MEDIUM
**Pattern:** ATDD test scaffolds generated during the red phase retain `@moduletag :skip` after the story is fully implemented. Sprint status or story docs show `completed`, but tests are still skipped — giving false confidence about coverage.
**Detection:** Search `grep -r "@moduletag :skip" test/` and cross-reference each file against its story status in the sprint tracker. If the story is done, activate or remove the scaffold.

## Multi-Tenancy Verification Patterns

### Custom Repo function used but not defined
**Severity:** CRITICAL
**Pattern:** A context module uses `Repo.transact/1`, `Repo.with_lock/2`, or another custom Ecto helper. `mix compile` may succeed because Ecto's `__using__` macro generates wrapper functions or the call resolves at runtime, but `mix test` may not exercise the transaction-failure path. In production, any deadlock or constraint violation inside the transaction raises `UndefinedFunctionError`.
**Detection:**
1. `grep -rn "Repo\.transact\|Repo\.with_lock" lib/<app>/`
2. `grep -rn "def transact\|def with_lock" lib/<app>/repo.ex` — if nothing found, the function is likely undefined.
3. Check `deps/` for libraries like `EctoShorts` or `Ecto.Repo.Scout` that might add `transact`.
4. Read `lib/<app>/repo.ex` directly to confirm it is a bare `use Ecto.Repo` — no custom macros.
**Fix:** Replace `Repo.transact` with the canonical `Repo.transaction`. If the codebase intentionally uses a custom macro, document it in `AGENTS.md` or `README.md`.
```elixir
# Before (undefined)
Repo.transact(fn -> ... end)

# After (canonical)
Repo.transaction(fn -> ... end)
```
**Verification:** Run `mix test` with a test that forces a constraint violation inside the transaction to confirm the error path works.

### Missing pending-invitations discovery endpoint
**Severity:** MEDIUM
**Pattern:** A story AC claims invited users "see the workspace in their list upon next login," but the codebase only implements `accept_invitation` (requires a token URL). There is no `/invitations/pending` or equivalent route for a user to discover active invitations without out-of-band knowledge.
**Detection:**
1. Search `router.ex` for routes matching `invitation`.
2. Verify there is a GET route that lists pending invitations for the logged-in user.
3. Check the context module — `list_pending_invitations_for_email/1` may exist but have no consumer in the web layer.
**Fix:** Add a controller action or LiveView:
```elixir
# router.ex — add to :require_authenticated_user scope
get "/invitations/pending", WorkspaceController, :pending_invitations

# controller
def pending_invitations(conn, _params) do
  invitations = Workspaces.list_pending_invitations_for_email(conn.assigns.current_scope.user.email)
  render(conn, :pending_invitations, invitations: invitations)
end
```

### Cascading delete declared but untested
**Severity:** MEDIUM
**Pattern:** Schema declares `has_many :workspace_memberships, ..., on_delete: :delete_all` and the migration adds `on_delete: :delete_all` on foreign keys. The declaration looks correct, but no test verifies the cascade actually fires when the parent is deleted. Future migrations (leads, campaigns, billing plans) may forget to add `on_delete` constraints, and the test suite will still pass.
**Detection:**
1. Search `test/` for a test that creates a workspace with memberships/invitations, deletes the workspace, and asserts the children are gone.
2. If no such test exists, flag it.
**Fix:** Add an explicit test that checks the DB after deletion:
```elixir
test "delete_workspace/1 cascades memberships and invitations", %{user: user} do
  {:ok, workspace} = Workspaces.create_workspace(user, %{"name" => "Cascade", "slug" => "cascade"})
  {:ok, _} = Workspaces.invite_member(workspace, %{"email" => "guest@example.com"})

  # Verify preconditions
  assert length(Repo.all(Workspaces.WorkspaceMembership)) == 1
  assert length(Repo.all(Workspaces.WorkspaceInvitation)) == 1

  Workspaces.delete_workspace(workspace)

  assert Repo.all(Workspaces.WorkspaceMembership) == []
  assert Repo.all(Workspaces.WorkspaceInvitation) == []
end
```

### Silent nil on stale session workspace without UX feedback
**Severity:** LOW
**Pattern:** `FetchCurrentWorkspace` fetches a workspace slug from the session and calls `get_workspace!(user, slug)`. If the user was removed from that workspace, `Ecto.NoResultsError` is rescued and the plug returns `nil`. No flash message or log entry is emitted. The user sees no workspace selected and has no idea why.
**Detection:**
1. Read `lib/<app>_web/plugs/fetch_current_workspace.ex`.
2. Look at the `rescue Ecto.NoResultsError` path — if it returns `nil` silently, that's the pattern.
**Fix:** Emit a flash warning to explain the cleared selection:
```elixir
try do
  Workspaces.get_workspace!(user, slug)
rescue
  Ecto.NoResultsError ->
    conn
    |> Phoenix.Controller.put_flash(:warning, "Your previously selected workspace is no longer available.")
    |> clear_session([:current_workspace_slug])
    nil
end
```
Alternatively, add a telemetry/security event for monitoring.

## Post-Review Fix Application Patterns

### Cascading signature changes after adding required parameters
**Severity:** MEDIUM (mechanical, but error-prone)
**Pattern:** A code review forces context functions to change arity — for example, adding `%User{}` as the first argument so the function can internally wrap queries in `Rls.with_user/2`. Every caller in controllers, plugs, and tests must be updated. `mix compile` may succeed with warnings if some callers are in `@moduletag :skip` test modules, giving false confidence.
**Detection checklist:**
1. After changing a function signature, grep for all callers: `grep -rn "old_function_name(" lib/ test/`
2. Check compiler output for `warning: undefined function` — especially in test files.
3. Run `mix test` for each affected test file individually to confirm.
**Fix:** Update all callers systematically. For tests that are `@moduletag :skip` and emit warnings, evaluate whether fixing the warning is worth the risk of scoping issues. If the test module is already skipped (red-phase scaffold for a future story), the warning is benign — document it in the story file and move on.

### Compiler warnings in `@moduletag :skip` tests during signature migration
**Severity:** LOW
**Pattern:** A test module is marked `@moduletag :skip` because it is a red-phase scaffold for a not-yet-implemented story. When an unrelated signature change affects functions it references, the compiler emits `warning: undefined function` during `mix compile`. The tests do not run, so no test failure occurs. Developers may waste time chasing warnings in dead code.
**Fix:** Do not reflexively fix warnings in skipped test modules. Check `sprint-status.yaml` or the story `.md` file first. If the story is still `not_started` or `in_progress`, the warning is expected and benign. Only fix the warning if the story is `completed` and the scaffold should have been activated or removed.
