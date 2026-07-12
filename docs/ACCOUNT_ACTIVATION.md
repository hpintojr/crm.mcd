# Mercury Call Desk — Account Activation

The public account-activation surface is `/activate?token=<one-time-token>`, backed by `POST /api/activate`.

## Activation boundary

- Activation tokens are stored only as hashes.
- Only unused, unexpired tokens with purpose `ACTIVATION` are accepted.
- Disabled users cannot prepare or complete activation.
- The API request body is limited to 8 KiB using both declared content length and actual UTF-8 size.
- Tokens are trimmed and limited to 512 characters.
- Passwords require 12–256 characters and at least one non-whitespace character.
- TOTP secrets and codes are format- and length-bounded before authenticator validation.
- Every JSON response is `no-store`, `noindex`, and includes an `X-Request-Id`.
- Errors returned publicly are generic and do not expose token hashes, user records, database hosts, stack traces, or cryptographic error details.

## Token privacy in the browser

The activation page is force-dynamic, `noindex`, and declares `Referrer-Policy: no-referrer` through page metadata.

After hydration, the client immediately replaces the browser address with `/activate`, removing the raw token from browser history. Activation API requests also use `referrerPolicy: "no-referrer"`.

The token remains only in the in-memory activation form long enough to prepare and complete the account. A refresh after the query string is removed intentionally requires a new activation link.

## MFA preparation

The prepare step:

1. validates the token and password fields;
2. generates a new authenticator secret and QR data URL;
3. records `ACTIVATION_STARTED` with request ID and IP address;
4. returns only `ok`, QR data, and the TOTP secret.

The prepare response does not return the account email. The page already displays the intended account identity to the token holder.

## Atomic single-use completion

The complete step verifies the TOTP code and hashes the password before entering one database transaction.

Inside that transaction:

1. `ActivationToken.updateMany` consumes the specific token only when it is still unused and unexpired;
2. exactly one row must be consumed;
3. the current User is re-read and must not be disabled;
4. password, Active status, MFA secret, and lockout counters are updated;
5. `MFA_ENROLLED` and `ACTIVATION_COMPLETED` audits are recorded.

If two completion requests race, only one transaction can consume the token. The losing request receives the same invalid-or-expired response and cannot overwrite the winning password or MFA configuration. If any later operation in the winning transaction fails, the entire transaction—including token consumption—rolls back.

## Regression check

`npm run check:account-activation-boundary` verifies schema bounds, password/TOTP validation, atomic consume ordering, current-user revalidation, minimal prepare response, token-history removal, no-referrer behavior, audit requirements, and build/deployment wiring.

The guard does not activate an account, query production activation tokens, mutate production data, or submit a TOTP code.

## Safety boundary

This hardening does not change who receives activation links, token expiration, user roles, intended account eligibility, MFA requirement, or post-activation login routing. No production activation endpoint was invoked during implementation or verification.
