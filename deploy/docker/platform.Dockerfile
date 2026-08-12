FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --chown=65532:65532 bin/platformapi /platformapi
COPY --chown=65532:65532 bin/mailworker /mailworker
COPY --chown=65532:65532 bin/fileworker /fileworker
COPY --chown=65532:65532 bin/operationsmonitor /operationsmonitor
COPY --chown=65532:65532 resources/fonts/NotoSansSCRegular.ttf /app/resources/fonts/NotoSansSCRegular.ttf
COPY --chown=65532:65532 resources/fonts/OFL.txt /app/resources/fonts/OFL.txt
ENV PDF_FONT_PATH=/app/resources/fonts/NotoSansSCRegular.ttf
USER 65532:65532
EXPOSE 8090
ENTRYPOINT ["/platformapi"]
