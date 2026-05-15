package com.audit.platform.modules.ai.controller;

import com.audit.platform.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Streams RAG task progress to the browser via SSE while the Python service is polled internally.
 */
@Slf4j
@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@Tag(name = "AI RAG Stream", description = "Server-Sent Events for RAG analysis progress")
public class AiRagStreamController {

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ExecutorService executor = Executors.newCachedThreadPool();

    @GetMapping(value = "/analyze/events/{taskId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'AUDITOR')")
    @Operation(summary = "Subscribe to RAG analysis events for a Python task id")
    public SseEmitter streamAnalysis(@PathVariable String taskId) {
        SseEmitter emitter = new SseEmitter(120_000L);
        String base = appProperties.getAi().getRag().getBaseUrl().replaceAll("/$", "");
        executor.execute(() -> {
            try {
                while (true) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> status = restTemplate.getForObject(
                            base + "/analyze/" + taskId + "/status",
                            Map.class
                    );
                    if (status == null) {
                        emitter.send(SseEmitter.event().data("{\"error\":\"no_status\"}"));
                        emitter.complete();
                        return;
                    }
                    emitter.send(SseEmitter.event().data(objectMapper.writeValueAsString(status)));
                    Object s = status.get("status");
                    if ("error".equals(s)) {
                        emitter.complete();
                        return;
                    }
                    if ("done".equals(s)) {
                        break;
                    }
                    Thread.sleep(500);
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> result = restTemplate.getForObject(
                        base + "/analyze/" + taskId + "/result",
                        Map.class
                );
                emitter.send(SseEmitter.event()
                        .name("result")
                        .data(objectMapper.writeValueAsString(result != null ? result : Map.of())));
                emitter.complete();
            } catch (Exception ex) {
                log.warn("SSE stream ended with error: {}", ex.getMessage());
                emitter.completeWithError(ex);
            }
        });
        return emitter;
    }
}
