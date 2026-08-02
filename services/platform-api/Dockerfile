FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY app ./app
COPY services/platform-api ./services/platform-api
RUN CGO_ENABLED=0 go build -trimpath -o /platform-api ./services/platform-api/cmd/server && \
	CGO_ENABLED=0 go build -trimpath -o /mail-worker ./services/platform-api/cmd/mail-worker && \
	CGO_ENABLED=0 go build -trimpath -o /file-worker ./services/platform-api/cmd/file-worker

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /platform-api /platform-api
COPY --from=build /mail-worker /mail-worker
COPY --from=build /file-worker /file-worker
EXPOSE 8090
ENTRYPOINT ["/platform-api"]
