FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --chown=65532:65532 bin/platform-api /platform-api
COPY --chown=65532:65532 bin/mail-worker /mail-worker
COPY --chown=65532:65532 bin/file-worker /file-worker
COPY --chown=65532:65532 bin/operations-monitor /operations-monitor
COPY --chown=65532:65532 resources/fonts/NotoSansSC-Regular.ttf /app/resources/fonts/NotoSansSC-Regular.ttf
COPY --chown=65532:65532 resources/fonts/OFL.txt /app/resources/fonts/OFL.txt
ENV PDF_FONT_PATH=/app/resources/fonts/NotoSansSC-Regular.ttf
USER 65532:65532
EXPOSE 8090
ENTRYPOINT ["/platform-api"]
