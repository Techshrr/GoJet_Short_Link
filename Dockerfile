FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY app/observability ./app/observability
COPY services/redirectengine ./services/redirectengine
RUN CGO_ENABLED=0 go build -trimpath -o /redirectengine ./services/redirectengine/cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /redirectengine /redirectengine
EXPOSE 8080
ENTRYPOINT ["/redirectengine"]
