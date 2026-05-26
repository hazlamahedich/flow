# Ecto `Repo.insert` changeset validation: "can't be blank" vs "required"

## The pattern

Ecto's `validate_required/1` produces `"can't be blank"` _by default_ in the `errors_on(changeset).field_name` list. Do NOT assert `"required"` — that string does **not** appear in the errors list.

## Correct assertion pattern

```elixir
changeset = MySchema.changeset(%MySchema{}, %{})
refute changeset.valid?
assert "can't be blank" in errors_on(changeset).required_field_a
assert "can't be blank" in errors_on(changeset).required_field_b
```

## Incorrect (produces test failure)

```elixir
assert "required" in errors_on(changeset).workspace_id
  # FAILS: rights list is ["can't be blank"], not ["required"]
```

## If you want a custom message

Use `validate_required/2` with a custom `:message` option:

```elixir
|> validate_required([:workspace_id, :name], message: "is required")
```

Then assert `"is required" in errors_on(...).workspace_id`. The story default (no custom message) should assert `"can't be blank"`.
