package com.audit.platform.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private final Jwt jwt = new Jwt();
    private final Cors cors = new Cors();
    private final Minio minio = new Minio();
    private final Ai ai = new Ai();
    private int clientDocQuotaMb = 500;
    private final RateLimit rateLimit = new RateLimit();

    @Getter
    @Setter
    public static class Jwt {
        private String secret;
        private long accessTokenMinutes = 15;
        private long refreshTokenDays = 7;
    }

    @Getter
    @Setter
    public static class Cors {
        private String allowedOrigins = "http://localhost:3000";
    }

    @Getter
    @Setter
    public static class Minio {
        private String endpoint;
        private String accessKey;
        private String secretKey;
        private final Buckets buckets = new Buckets();

        @Getter
        @Setter
        public static class Buckets {
            private String documents = "documents";
            private String reports = "reports";
            private String chatFiles = "chat-files";
        }
    }

    @Getter
    @Setter
    public static class Ai {
        private final Groq groq = new Groq();
        private final Mistral mistral = new Mistral();
        private final OpenAi openai = new OpenAi();
        private final Rag rag = new Rag();

        @Getter
        @Setter
        public static class Rag {
            /**
             * Python FastAPI RAG service (e.g. http://localhost:8000).
             */
            private String baseUrl = "http://localhost:8000";
            /**
             * Public URL of this Spring app for document download links passed to RAG (no trailing slash).
             */
            private String publicBaseUrl = "http://localhost:8080";
            /** Logical model label for persistence (matches Python OLLAMA_MODEL when applicable). */
            private String modelName = "mistral";
        }

        @Getter
        @Setter
        public static class Groq {
            private String apiKey;
            private String baseUrl = "https://api.groq.com/openai/v1";
            private String model = "llama-3.3-70b-versatile";
        }

        @Getter
        @Setter
        public static class Mistral {
            private String apiKey;
            private String baseUrl = "https://api.mistral.ai/v1";
            private String model = "mistral-small-latest";
        }

        @Getter
        @Setter
        public static class OpenAi {
            private String apiKey;
            private String baseUrl = "https://api.openai.com/v1";
            private String model = "gpt-4o-mini";
        }
    }

    @Getter
    @Setter
    public static class RateLimit {
        private int authPerMinute = 10;
    }
}
