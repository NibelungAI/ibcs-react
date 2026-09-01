# Security Policy

## Supported versions

`ibcs-react` follows semantic versioning. Security fixes land on the latest
minor release; please upgrade to the newest version before reporting.

## Reporting a vulnerability

Please report security issues **privately** - do not open a public issue.

- Email **contact@nibelung.io** with a description, affected version, and a
  reproduction if possible.
- We aim to acknowledge within **3 business days** and to ship a fix or
  mitigation as quickly as the severity warrants.

## Scope

`ibcs-react` is a **client-side rendering** library with **zero runtime
dependencies** - charts are hand-rolled inline SVG and components are
server-render-safe. The attack surface is therefore small, but we still take
reports seriously (e.g. unsanitized values reaching the DOM, ReDoS in a helper,
SSR data leakage). Issues in your own data pipeline or in a peer dependency
(React) are out of scope here.
