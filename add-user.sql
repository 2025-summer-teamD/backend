INSERT INTO users ("clerkId", "createdAt", "isDeleted") 
VALUES ('user_2ztzjWWEERoGOIhxMspINR4qhGS', NOW(), false) 
ON CONFLICT ("clerkId") DO NOTHING; 