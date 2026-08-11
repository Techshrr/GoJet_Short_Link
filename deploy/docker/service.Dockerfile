FROM gcr.io/distroless/static-debian12:nonroot
ARG BINARY
COPY --chown=65532:65532 bin/${BINARY} /service
USER 65532:65532
ENTRYPOINT ["/service"]
