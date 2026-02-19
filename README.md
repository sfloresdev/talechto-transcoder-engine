# talechto-transcoder-engine

High-performance audio transcoding API built with Bun, SQLite, and FFmpeg. This service manages audio processing, user identification, and rate-limiting for the Talechto platform.

## Architecture and Stack

* **Runtime:** Bun (v1.x)
* **Database:** SQLite with WAL (Write-Ahead Logging) mode enabled for high-concurrency logging.
* **Processing:** FFmpeg via asynchronous child processes.
* **Security:** SHA-256 IP hashing with a unique salt for anonymous rate-limiting.
* **Testing:** Native Bun test runner for integration and unit testing.

## Current Features

1. **Audio Conversion:** Asynchronous transcoding to multiple formats (MP3, WAV, etc.) via FFmpeg.
2. **Anonymous Rate Limiting:** 5 conversions per unique IP address per day.
3. **Automatic Cleanup:** Immediate deletion of temporary input/output files after the response stream is finalized.
4. **Activity Logging:** Internal database for tracking conversion status, errors, and usage metrics.

## Setup and Installation

1. Ensure FFmpeg is installed and accessible in the system PATH.
2. Install dependencies:
   ```bash
   bun install
    ```
    
## Roadmap and Technical Implementation

### Cloudflare Integration
The engine is architected to operate behind Cloudflare to leverage:
* **DDoS Protection:** Volumetric attack mitigation at the edge before reaching the Bun runtime.
* **WAF (Web Application Firewall):** Filtering of malicious payloads and automated bot detection to protect the FFmpeg process.
* **SSL/TLS Termination:** Secure encryption managed at the edge.
* **Client Identification:** The engine is prepared to extract the original client IP through Cloudflare specific headers (e.g., `CF-Connecting-IP`) to ensure rate-limiting accuracy.

### Logging Strategy
Currently, logs are stored in a relational SQLite table (`activity_logs`) to facilitate complex querying and internal monitoring.

* **Database Logging:** Used for application logic, such as counting daily conversions and identifying users who reach credit limits.
* **File-based logs (.log):** Future implementation of standard `.log` output is planned for infrastructure-level monitoring. This will allow compatibility with log rotation tools (logrotate) and external aggregators (Datadog, ELK) without polluting the relational database with high-volume ephemeral data.