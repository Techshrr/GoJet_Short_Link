FROM golang:1.24-alpine AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go test ./... && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /gojet-redirector .

FROM scratch
COPY --from=build /gojet-redirector /gojet-redirector
USER 65532:65532
ENTRYPOINT ["/gojet-redirector"]
