# Security

Eigenstate processes local synthetic state and user-selected JSON imports. It has no authentication service, server-side simulation, or account database.

Report vulnerabilities through Matthew's contact form at [crossinginto.ai](https://crossinginto.ai). Include the affected version, reproduction steps, and expected versus observed behavior. Do not attach secrets or personal browser data. Coordinate disclosure before publishing an exploit.

The checksum detects accidental corruption; it does not authenticate a snapshot's author. Imported state is treated as untrusted data, size-limited, structurally validated, and rendered as text. Unknown future snapshot versions are not overwritten. Keep backups before testing persistence changes.

Only the latest release is supported. Browser storage policies and clearing site data can remove local state. Use export for backups.
