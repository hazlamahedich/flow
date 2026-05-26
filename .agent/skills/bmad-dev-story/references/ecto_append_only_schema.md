# Ecto `inserted_at`-only table (no timestamps macro)

For append-only logs where `updated_at` must not exist, you cannot use `timestamps()` because it generates both columns. Instead:

## Migration: create the column manually

```elixir
create table(:agent_events) do
  add :event_type, :string, size: 64, null: false
  add :tenant_id, :uuid, null: false
  add :lead_id, references(:leads, on_delete: :delete_all, type: :id)
  add :payload, :map, null: false
  add :version, :integer, null: false, default: 1
  add :inserted_at, :utc_datetime_usec, default: fragment("NOW()")
end
```

_Note: `timestamps(type: :utc_datetime_usec)` is NOT used, so no `updated_at` column is created._

## Schema: omit timestamps macro

```elixir
schema "agent_events" do
  field :event_type, :string
  field :tenant_id, :binary_id
  belongs_to :lead, Lead, type: :id
  field :payload, :map
  field :version, :integer, default: 1
  field :inserted_at, :utc_datetime_usec
end
```

_Note: No `timestamps(type: :utc_datetime_usec)` call in this schema. The struct will not have `updated_at`._

## Gotcha: inserted_at default needs `default: fragment("NOW()")` in migration

Without the default, inserting via `Repo.insert` without an explicit `:inserted_at` will succeed but the column will be `nil` until the DB writes its trigger or default. Using `NOW()` at migration level is safest.

## Changeset strategy

The changeset should still accept `:inserted_at` in `cast/3` so callers can override (e.g., replaying historical events), but mark it as _not_ required via `validate_required/1`. `Repo.insert!()` will use the DB default if omitted.

```elixir
def changeset(agent_event, attrs) do
  agent_event
  |> cast(attrs, [:event_type, :tenant_id, :lead_id, :payload, :version, :inserted_at])
  |> validate_required([:event_type, :tenant_id, :payload])
end
```
