FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/log-receiver ./services/log-receiver/cmd/server
FROM alpine:3.21
RUN adduser -D -H -u 10001 gojet
USER gojet
COPY --from=build /out/log-receiver /log-receiver
EXPOSE 8092
ENTRYPOINT ["/log-receiver"]
