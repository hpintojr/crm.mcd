# Recovery Status

This branch starts from the last known-working application commit:

```text
a80b8159df8331af0c84d3a098f54e880edecca5
feat(servicing): work and resolve cases from queue
```

Purpose: verify authenticated Admin and Portal access in an isolated preview before restoring later changes in small batches.

Do not merge or promote this branch until `/login`, `/admin`, and `/portal` have been verified in the preview environment.
