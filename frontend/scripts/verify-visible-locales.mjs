// Compatibility entry retained because the v5.0.2 aggregate verifier checks this
// historical script path. The production audit itself lives at the connector-free
// path verifyvisiblelocales.mjs and covers apps/site/src, apps/workspace/src and
// apps/admin/src. VISIBLE_LOCALE_GATE remains a required release contract.
import "./verifyvisiblelocales.mjs";
