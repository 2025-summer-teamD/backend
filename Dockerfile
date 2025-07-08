# Build stage
FROM golang:1.23-alpine AS builder

# 작업 디렉토리 설정
WORKDIR /app

# Go modules 파일 복사
COPY go.mod go.sum ./

# 의존성 다운로드
RUN go mod download

# 소스 코드 복사
COPY . .

# 애플리케이션 빌드
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Production stage
FROM alpine:latest

# 필요한 패키지 설치
RUN apk --no-cache add ca-certificates tzdata

# 작업 디렉토리 설정
WORKDIR /root/

# 빌드된 실행 파일 복사
COPY --from=builder /app/main .

# 포트 노출
EXPOSE 8080

# 애플리케이션 실행
CMD ["./main"] 