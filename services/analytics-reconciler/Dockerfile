FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY services/analytics-reconciler ./services/analytics-reconciler
RUN CGO_ENABLED=0 go build -trimpath -o /analytics-reconciler ./services/analytics-reconciler/cmd/reconciler

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /analytics-reconciler /analytics-reconciler
ENTRYPOINT ["/analytics-reconciler"]
