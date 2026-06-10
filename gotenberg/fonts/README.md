# Optional Office fonts

Place separately licensed `.ttf`, `.otf`, or `.ttc` files in this directory
before building the Gotenberg image. The files are copied into the image and
registered through Fontconfig.

The font binaries are intentionally ignored by Git. Microsoft Office cloud
fonts such as Aptos are proprietary and must not be committed or redistributed
unless the deployment owner has obtained a license that permits server-side
installation and image distribution.

Without supplied Aptos files, BrainVault maps `Aptos` and `Aptos Display` to
Arial to reduce layout changes compared with LibreOffice's default Noto Sans
substitution.
