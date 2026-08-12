FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY services/analyticsreconciler ./services/analyticsreconciler
RUN CGO_ENABLED=0 go build -trimpath -o /analyticsreconciler ./services/analyticsreconciler/cmd/reconciler

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /analyticsreconciler /analyticsreconciler
ENTRYPOINT ["/analyticsreconciler"]
