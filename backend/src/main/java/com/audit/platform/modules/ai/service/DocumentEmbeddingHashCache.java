package com.audit.platform.modules.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory registry of document content hashes seen for RAG runs.
 * Keys follow the convention {@code embedding_<sha256_hex>}.
 */
@Slf4j
@Service
public class DocumentEmbeddingHashCache {

    private final ConcurrentHashMap<String, Boolean> store = new ConcurrentHashMap<>();

    public boolean isKnown(String sha256Hex) {
        if (sha256Hex == null || sha256Hex.isBlank()) {
            return false;
        }
        return store.containsKey(key(sha256Hex));
    }

    public void remember(String sha256Hex) {
        if (sha256Hex == null || sha256Hex.isBlank()) {
            return;
        }
        String k = key(sha256Hex);
        if (store.putIfAbsent(k, Boolean.TRUE) == null) {
            log.info("Registered embedding cache entry {}", k);
        } else {
            log.info("Embedding cache hit for {}", k);
        }
    }

    private static String key(String sha256Hex) {
        return "embedding_" + sha256Hex;
    }
}
