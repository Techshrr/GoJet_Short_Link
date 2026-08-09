#!/usr/bin/env python3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

main=ROOT/'services/platform-api/cmd/server/main.go'; text=main.read_text()
text=text.replace('mux.HandleFunc("POST /api/auth/forgot-password", s.resetPassword)','mux.HandleFunc("POST /api/auth/forgot-password", s.requestPasswordReset)')
if 'mux.HandleFunc("POST /api/auth/forgot-password", s.requestPasswordReset)' not in text:
    raise SystemExit('forgot-password route is not connected to requestPasswordReset')
main.write_text(text)

admin=ROOT/'app/adminauth/service.go'; text=admin.read_text()
if 'requested = append(requested, "platform.read")' not in text:
    needle='\tif len(requested) == 0 && role != "custom" {\n\t\trequested = roleTemplates[role]\n\t}\n'
    if needle not in text: raise SystemExit('admin permission normalization point missing')
    text=text.replace(needle,needle+'\t// Every administrator can restore its own authenticated shell.\n\trequested = append(requested, "platform.read")\n',1)
admin.write_text(text)

for path in ['services/platform-api/cmd/server/admin_identity.go','services/platform-api/cmd/server/main.go','frontend/admin-console/app.js','frontend/admin-console/product-actions.js','frontend/admin-console/settings-full.js']:
    source=(ROOT/path).read_text()
    for forbidden in ['adminStepUp','stepUpRequiredForPath','verifyAdminStepUp','step_up_required','X-GoJet-TOTP']:
        if forbidden in source: raise SystemExit(f'obsolete operation step-up marker {forbidden} found in {path}')

identity=(ROOT/'services/platform-api/cmd/server/identity.go').read_text()
for required in ['func (s *server) requestPasswordReset(', 'loginRateExceeded', 'blockedRegistrationEmail', 'RevokeToken(r.Context(), token)']:
    if required not in identity: raise SystemExit(f'identity invariant missing: {required}')
print('V4 core invariants converged')
