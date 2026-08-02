FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY services/analytics-worker ./services/analytics-worker
RUN CGO_ENABLED=0 go build -trimpath -o /analytics-worker ./services/analytics-worker/cmd/worker

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /analytics-worker /analytics-worker
ENTRYPOINT ["/analytics-worker"]
