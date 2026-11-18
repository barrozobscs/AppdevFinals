CREATE DATABASE  IF NOT EXISTS `hims_database_updated` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `hims_database_updated`;
-- MySQL dump 10.13  Distrib 8.0.46, for Win64 (x86_64)
--
-- Host: localhost    Database: hims_database
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `answer`
--

DROP TABLE IF EXISTS `answer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `answer` (
  `answer_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `attempt_id` bigint unsigned NOT NULL,
  `question_id` bigint unsigned NOT NULL,
  `option_id` bigint unsigned DEFAULT NULL,
  `earned_score` decimal(10,2) DEFAULT NULL,
  `is_correct` tinyint(1) DEFAULT NULL,
  `response_text` text,
  PRIMARY KEY (`answer_id`),
  KEY `idx_answer_attempt_id` (`attempt_id`),
  KEY `idx_answer_question_id` (`question_id`),
  KEY `idx_answer_option_pair` (`question_id`,`option_id`),
  KEY `fk_answer_option` (`option_id`),
  CONSTRAINT `fk_answer_attempt` FOREIGN KEY (`attempt_id`) REFERENCES `attempt` (`attempt_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_answer_option` FOREIGN KEY (`option_id`) REFERENCES `option` (`option_id`),
  CONSTRAINT `fk_answer_question` FOREIGN KEY (`question_id`) REFERENCES `question` (`question_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_answer_earned_score_nonnegative` CHECK (((`earned_score` is null) or (`earned_score` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `answer`
--

LOCK TABLES `answer` WRITE;
/*!40000 ALTER TABLE `answer` DISABLE KEYS */;
INSERT INTO `answer` VALUES (1,1,1,1,5.00,1,NULL),(2,1,2,5,0.00,0,NULL);
/*!40000 ALTER TABLE `answer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attempt`
--

DROP TABLE IF EXISTS `attempt`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `attempt` (
  `attempt_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quiz_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `start_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completion_time` datetime DEFAULT NULL,
  `percentage` decimal(5,2) DEFAULT NULL,
  `score` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`attempt_id`),
  KEY `idx_attempt_quiz_id` (`quiz_id`),
  KEY `idx_attempt_user_id` (`user_id`),
  KEY `idx_attempt_start_time` (`start_time`),
  CONSTRAINT `fk_attempt_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quiz` (`quiz_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_attempt_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_attempt_percentage` CHECK (((`percentage` is null) or (`percentage` between 0 and 100))),
  CONSTRAINT `chk_attempt_score_nonnegative` CHECK (((`score` is null) or (`score` >= 0)))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attempt`
--

LOCK TABLES `attempt` WRITE;
/*!40000 ALTER TABLE `attempt` DISABLE KEYS */;
INSERT INTO `attempt` VALUES (1,1,1,'2026-11-15 18:00:35','2026-11-15 18:01:03',50.00,5.00);
/*!40000 ALTER TABLE `attempt` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material`
--

DROP TABLE IF EXISTS `material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `material` (
  `material_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(1024) NOT NULL,
  `file_type` varchar(100) NOT NULL,
  `upload_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `processing_status` varchar(50) NOT NULL DEFAULT 'pending',
  PRIMARY KEY (`material_id`),
  KEY `idx_material_user_id` (`user_id`),
  KEY `idx_material_upload_date` (`upload_date`),
  KEY `idx_material_processing_status` (`processing_status`),
  CONSTRAINT `fk_material_uploader` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material`
--

LOCK TABLES `material` WRITE;
/*!40000 ALTER TABLE `material` DISABLE KEYS */;
INSERT INTO `material` VALUES (1,1,'Introduction to Data Structures.pdf','/uploads/sample/data_structures.pdf','application/pdf','2026-11-15 17:57:21','completed');
/*!40000 ALTER TABLE `material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `option`
--

DROP TABLE IF EXISTS `option`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `option` (
  `option_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `question_id` bigint unsigned NOT NULL,
  `option_text` text NOT NULL,
  `is_correct` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`option_id`),
  UNIQUE KEY `uq_option_question_pair` (`question_id`,`option_id`),
  KEY `idx_option_question_id` (`question_id`),
  CONSTRAINT `fk_option_question` FOREIGN KEY (`question_id`) REFERENCES `question` (`question_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `option`
--

LOCK TABLES `option` WRITE;
/*!40000 ALTER TABLE `option` DISABLE KEYS */;
INSERT INTO `option` VALUES (1,1,'Stack',1),(2,1,'Queue',0),(3,1,'Array',0),(4,1,'Tree',0),(5,2,'Stack',0),(6,2,'Queue',1),(7,2,'Tree',0),(8,2,'Graph',0);
/*!40000 ALTER TABLE `option` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `question`
--

DROP TABLE IF EXISTS `question`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `question` (
  `question_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `quiz_id` bigint unsigned NOT NULL,
  `topic_id` bigint unsigned NOT NULL,
  `question_text` text NOT NULL,
  `question_type` varchar(50) NOT NULL,
  `points` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`question_id`),
  KEY `idx_question_quiz_id` (`quiz_id`),
  KEY `idx_question_topic_id` (`topic_id`),
  KEY `idx_question_type` (`question_type`),
  CONSTRAINT `fk_question_quiz` FOREIGN KEY (`quiz_id`) REFERENCES `quiz` (`quiz_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_question_topic` FOREIGN KEY (`topic_id`) REFERENCES `topic` (`topic_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_question_points_nonnegative` CHECK ((`points` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `question`
--

LOCK TABLES `question` WRITE;
/*!40000 ALTER TABLE `question` DISABLE KEYS */;
INSERT INTO `question` VALUES (1,1,1,'Which data structure follows the LIFO principle?','multiple_choice',5.00),(2,1,1,'Which data structure follows the FIFO principle?','multiple_choice',5.00);
/*!40000 ALTER TABLE `question` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quiz`
--

DROP TABLE IF EXISTS `quiz`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quiz` (
  `quiz_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `material_id` bigint unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `date_created` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `total_points` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`quiz_id`),
  KEY `idx_quiz_material_id` (`material_id`),
  KEY `idx_quiz_date_created` (`date_created`),
  CONSTRAINT `fk_quiz_material` FOREIGN KEY (`material_id`) REFERENCES `material` (`material_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_quiz_total_points_nonnegative` CHECK ((`total_points` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quiz`
--

LOCK TABLES `quiz` WRITE;
/*!40000 ALTER TABLE `quiz` DISABLE KEYS */;
INSERT INTO `quiz` VALUES (1,1,'Data Structures Fundamentals','2026-11-15 17:59:11',10.00);
/*!40000 ALTER TABLE `quiz` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `reviewer`
--

DROP TABLE IF EXISTS `reviewer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `reviewer` (
  `reviewer_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `material_id` bigint unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` longtext NOT NULL,
  `generated_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`reviewer_id`),
  KEY `idx_reviewer_material_id` (`material_id`),
  KEY `idx_reviewer_generated_date` (`generated_date`),
  CONSTRAINT `fk_reviewer_material` FOREIGN KEY (`material_id`) REFERENCES `material` (`material_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `reviewer`
--

LOCK TABLES `reviewer` WRITE;
/*!40000 ALTER TABLE `reviewer` DISABLE KEYS */;
/*!40000 ALTER TABLE `reviewer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roadmap`
--

DROP TABLE IF EXISTS `roadmap`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roadmap` (
  `roadmap_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `title` varchar(255) NOT NULL,
  `date_created` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `last_updated` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`roadmap_id`),
  KEY `idx_roadmap_user_id` (`user_id`),
  KEY `idx_roadmap_status` (`status`),
  CONSTRAINT `fk_roadmap_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roadmap`
--

LOCK TABLES `roadmap` WRITE;
/*!40000 ALTER TABLE `roadmap` DISABLE KEYS */;
/*!40000 ALTER TABLE `roadmap` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roadmap_item`
--

DROP TABLE IF EXISTS `roadmap_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roadmap_item` (
  `item_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `roadmap_id` bigint unsigned NOT NULL,
  `topic_id` bigint unsigned NOT NULL,
  `sequence_number` int unsigned NOT NULL,
  `priority_reason` text,
  `completion_status` varchar(50) NOT NULL DEFAULT 'not_started',
  PRIMARY KEY (`item_id`),
  UNIQUE KEY `uq_roadmap_item_sequence` (`roadmap_id`,`sequence_number`),
  KEY `idx_roadmap_item_roadmap_id` (`roadmap_id`),
  KEY `idx_roadmap_item_topic_id` (`topic_id`),
  KEY `idx_roadmap_item_completion_status` (`completion_status`),
  CONSTRAINT `fk_roadmap_item_roadmap` FOREIGN KEY (`roadmap_id`) REFERENCES `roadmap` (`roadmap_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_roadmap_item_topic` FOREIGN KEY (`topic_id`) REFERENCES `topic` (`topic_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roadmap_item`
--

LOCK TABLES `roadmap_item` WRITE;
/*!40000 ALTER TABLE `roadmap_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `roadmap_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topic`
--

DROP TABLE IF EXISTS `topic`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `topic` (
  `topic_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `topic_name` varchar(200) NOT NULL,
  `description` text,
  PRIMARY KEY (`topic_id`),
  KEY `idx_topic_name` (`topic_name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topic`
--

LOCK TABLES `topic` WRITE;
/*!40000 ALTER TABLE `topic` DISABLE KEYS */;
INSERT INTO `topic` VALUES (1,'Introduction to Data Structures','Fundamental concepts of data structures, their types, and applications.');
/*!40000 ALTER TABLE `topic` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topic_material`
--

DROP TABLE IF EXISTS `topic_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `topic_material` (
  `topic_id` bigint unsigned NOT NULL,
  `material_id` bigint unsigned NOT NULL,
  PRIMARY KEY (`topic_id`,`material_id`),
  KEY `idx_topic_material_material_id` (`material_id`),
  CONSTRAINT `fk_topic_material_material` FOREIGN KEY (`material_id`) REFERENCES `material` (`material_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_topic_material_topic` FOREIGN KEY (`topic_id`) REFERENCES `topic` (`topic_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topic_material`
--

LOCK TABLES `topic_material` WRITE;
/*!40000 ALTER TABLE `topic_material` DISABLE KEYS */;
INSERT INTO `topic_material` VALUES (1,1);
/*!40000 ALTER TABLE `topic_material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user`
--

DROP TABLE IF EXISTS `user`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user` (
  `user_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `full_name` varchar(200) NOT NULL,
  `email` varchar(254) NOT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `date_registered` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `privacy_consent_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_user_email` (`email`),
  KEY `idx_user_full_name` (`full_name`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user`
--

LOCK TABLES `user` WRITE;
/*!40000 ALTER TABLE `user` DISABLE KEYS */;
INSERT INTO `user` (`user_id`, `full_name`, `email`, `password_hash`, `date_registered`) VALUES (1,'John Doe','johndoe.test@example.com','$2b$12$abcdefghijklmnopqrstuu12345678901234567890123456789012','2026-11-15 17:56:41');
/*!40000 ALTER TABLE `user` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_topic_assessment`
--

DROP TABLE IF EXISTS `user_topic_assessment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_topic_assessment` (
  `user_id` bigint unsigned NOT NULL,
  `topic_id` bigint unsigned NOT NULL,
  `total_answered` int unsigned NOT NULL DEFAULT '0',
  `correct_count` int unsigned NOT NULL DEFAULT '0',
  `accuracy_rate` decimal(5,2) NOT NULL DEFAULT '0.00',
  `mastery_level` decimal(5,2) DEFAULT NULL,
  `last_assessed` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`,`topic_id`),
  KEY `idx_assessment_topic_id` (`topic_id`),
  CONSTRAINT `fk_assessment_topic` FOREIGN KEY (`topic_id`) REFERENCES `topic` (`topic_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_assessment_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chk_assessment_accuracy` CHECK ((`accuracy_rate` between 0 and 100)),
  CONSTRAINT `chk_assessment_correct_count` CHECK ((`correct_count` <= `total_answered`)),
  CONSTRAINT `chk_assessment_mastery` CHECK (((`mastery_level` is null) or (`mastery_level` between 0 and 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_topic_assessment`
--

LOCK TABLES `user_topic_assessment` WRITE;
/*!40000 ALTER TABLE `user_topic_assessment` DISABLE KEYS */;
INSERT INTO `user_topic_assessment` VALUES (1,1,2,1,50.00,NULL,'2026-11-15 18:10:55');
/*!40000 ALTER TABLE `user_topic_assessment` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-15 18:48:17

-- OAuth provider identities for Google and Facebook sign-in.
CREATE TABLE IF NOT EXISTS `oauth_identity` (
  `oauth_identity_id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `provider` varchar(30) NOT NULL,
  `provider_user_id` varchar(191) NOT NULL,
  `email` varchar(254) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`oauth_identity_id`),
  UNIQUE KEY `uq_oauth_provider_user` (`provider`, `provider_user_id`),
  KEY `idx_oauth_identity_user` (`user_id`),
  CONSTRAINT `fk_oauth_identity_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
