# Dependency baseline

Node 22 is the target runtime; Python 3.12 is the service baseline.
Next.js 15.5.27 is pinned within Amplify's currently documented native SSR range; React 19.3.1 is pinned.
All resolved JS dependencies are recorded in package-lock.json. Python runtime and dev locks are generated separately.

The initial npm audit reported vulnerabilities in Next's transitive PostCSS dependency.
A root npm override pins PostCSS 8.5.30 rather than forcing an unverified Next.js 16/hosting migration.
This change must be verified by a fresh install, production build, browser tests and npm audit; see reset evidence.
Advisories reported by the registry included GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q,
GHSA-fxqj-rqcc-2cmp and GHSA-r28c-9q8g-f849. Recheck advisories at every release.
A clean audit is not a complete application security assessment.

CI third-party actions are pinned to resolved commit SHAs, not mutable tags. Updates require review.
Docker base images use major/runtime tags in this initial scaffold; digest pinning and image vulnerability evidence are production gates.
