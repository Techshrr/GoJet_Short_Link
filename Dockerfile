FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY services/redirect-engine ./services/redirect-engine
RUN CGO_ENABLED=0 go build -trimpath -o /redirect-engine ./services/redirect-engine/cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /redirect-engine /redirect-engine
EXPOSE 8080
ENTRYPOINT ["/redirect-engine"]
