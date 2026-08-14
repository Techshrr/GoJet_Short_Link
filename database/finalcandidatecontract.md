# Final candidate promotion contract

This file is repository contract documentation, not a migration and must never be added to `database/migrations/migrationcatalog.txt`.

A GoJet build may be promoted for real aaPanel fresh-install acceptance only when all required GitHub gates belong to the same current branch HEAD and are successful: Database Schema Naming, Analytics Dashboard, Authentication Policy, Installer Validation, Full-stack P0, Product Surface, Release Package (including its same-run Fresh Install Candidate), Public Payment Callback, and Payment Callback Browser.

The Release artifact must be produced by that exact HEAD, its immutable release evidence must name the same SHA, and the Fresh Install Candidate must download the package from the same Release workflow run, apply the packaged migration catalog to a fresh database, start the packaged runtime including destination-risk monitoring, and pass packaged P0 acceptance.

A newer commit invalidates all previous candidate status. Old green runs remain diagnostic evidence only and must not be inherited by a new candidate.
