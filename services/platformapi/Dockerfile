FROM golang:1.23-alpine AS build
WORKDIR /src
RUN apk add --no-cache curl git python3 py3-fonttools
COPY go.mod go.sum ./
RUN go mod download
COPY scripts/preparepdffonts.sh ./scripts/preparepdffonts.sh
RUN chmod 0755 ./scripts/preparepdffonts.sh && ./scripts/preparepdffonts.sh
COPY app ./app
COPY services/platformapi ./services/platformapi
RUN CGO_ENABLED=0 go build -trimpath -o /platformapi ./services/platformapi/cmd/server && \
	CGO_ENABLED=0 go build -trimpath -o /mailworker ./services/platformapi/cmd/mailworker && \
	CGO_ENABLED=0 go build -trimpath -o /fileworker ./services/platformapi/cmd/fileworker && \
	CGO_ENABLED=0 go build -trimpath -o /operationsmonitor ./services/platformapi/cmd/operationsmonitor

FROM gcr.io/distroless/static-debian12:nonroot
WORKDIR /app
COPY --from=build /platformapi /platformapi
COPY --from=build /mailworker /mailworker
COPY --from=build /fileworker /fileworker
COPY --from=build /operationsmonitor /operationsmonitor
COPY --from=build /src/resources/fonts/NotoSansSC-Regular.ttf /app/resources/fonts/NotoSansSC-Regular.ttf
COPY --from=build /src/resources/fonts/OFL.txt /app/resources/fonts/OFL.txt
ENV PDF_FONT_PATH=/app/resources/fonts/NotoSansSC-Regular.ttf
EXPOSE 8090
ENTRYPOINT ["/platformapi"]
