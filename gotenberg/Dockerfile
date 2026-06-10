FROM gotenberg/gotenberg:8.17.3@sha256:779d4cf9bb36cb645e26e03fdb1b929b5d0fd01bfa58c336da5e224dd154626e

USER root

COPY fontconfig/99-brainvault-office-fonts.conf /etc/fonts/conf.d/99-brainvault-office-fonts.conf
COPY fonts/ /usr/local/share/fonts/brainvault/

RUN fc-cache -f

USER gotenberg
