package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
)

func main() {
	// .env 파일 로드 (있을 경우)
	err := godotenv.Load()
	if err != nil {
		log.Println("No .env file found")
	}

	// PORT 환경변수 설정 (기본값: 8080)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Gin 라우터 설정
	r := gin.Default()

	// CORS 미들웨어 (간단한 버전)
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// API 라우트
	api := r.Group("/api/v1")
	{
		api.GET("/health", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "ok",
				"message": "서버가 정상 작동 중입니다",
			})
		})

		api.GET("/hello", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"message": "Hello from Go Backend!",
			})
		})
	}

	log.Printf("서버가 포트 %s에서 시작됩니다", port)
	log.Fatal(r.Run(":" + port))
} 