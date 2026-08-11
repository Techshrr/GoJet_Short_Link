FROM golang:1.23-alpine AS build
WORKDIR /src
RUN apk add --no-cache curl git
COPY go.mod go.sum ./
RUN go mod download
COPY scripts/prepare-pdf-fonts.sh ./scripts/prepare-pdf-fonts.sh
RUN chmod 0755 ./scripts/prepare-pdf-fonts.sh && ./scripts/prepare-pdf-fonts.sh
COPY app ./app
COPY services/platform-api ./services/platform-api
RUN CGO_ENABLED=0 go build -trimpath -o /platform-api ./services/platform-api/cmd/server && \
	CGO_ENABLED=0 go build -trimpath -o /mail-worker ./services/platform-api/cmd/mail-worker && \
	CGO_ENABLED=0 go build -trimpath -o /file-worker ./services/platform-api/cmd/file-worker && \
	CGO_ENABLED=0 go build -trimpath -o /operations-monitor ./services/platform-api/cmd/operations-monitor

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /platform-api /platform-api
COPY --from=build /mail-worker /mail-worker
COPY --from=build /file-worker /file-worker
COPY --from=build /operations-monitor /operations-monitor
COPY --from=build /src/resources/fonts /app/resources/fonts
ENV PDF_FONT_PATH=/app/resources/fonts/NotoSansSC-VF.ttf
EXPOSE 8090
ENTRYPOINT ["/platform-api"]
