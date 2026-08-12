FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY app/observability ./app/observability
COPY services/analyticsworker ./services/analyticsworker
RUN CGO_ENABLED=0 go build -trimpath -o /analyticsworker ./services/analyticsworker/cmd/worker

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /analyticsworker /analyticsworker
ENTRYPOINT ["/analyticsworker"]
