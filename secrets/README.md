# secrets/

Nada de lo que va acá se commitea (ver `.gitignore`) — es contenido que
solo debe existir en el VPS.

## `corpus_deploy_key`

Llave SSH privada, dedicada, con permiso de **solo escritura** sobre
`lodicho-corpus` (nada más) — la usa el backend (`app/services/corpus_git.py`)
para commitear y pushear automáticamente cuando se aprueba un documento
desde el panel de admin. Nunca la personal de nadie.

### Cómo generarla (una vez, en el VPS o en tu máquina)

```bash
ssh-keygen -t ed25519 -C "lodicho-corpus-deploy" -f corpus_deploy_key -N ""
```

Esto genera dos archivos: `corpus_deploy_key` (privada) y
`corpus_deploy_key.pub` (pública).

1. Copiá el contenido de `corpus_deploy_key.pub`.
2. En GitHub: repo `lodicho-corpus` → **Settings → Deploy keys → Add deploy key**.
   Pegá la clave pública, y marcá **"Allow write access"**.
3. Movés `corpus_deploy_key` (la privada) a esta carpeta, en el VPS:
   ```bash
   mv corpus_deploy_key /opt/lodicho/secrets/corpus_deploy_key
   chmod 600 /opt/lodicho/secrets/corpus_deploy_key
   ```
   El `chmod 600` es obligatorio — SSH rechaza una clave privada con
   permisos más abiertos que eso.
4. Borrá `corpus_deploy_key.pub` de donde la hayas generado si no la vas
   a necesitar más (ya quedó pegada en GitHub).

`docker-compose.yml` monta este archivo dentro del contenedor `api` en
`/run/secrets/corpus_deploy_key` (solo lectura).
