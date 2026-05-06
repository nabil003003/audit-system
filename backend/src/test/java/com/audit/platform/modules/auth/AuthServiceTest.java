package com.audit.platform.modules.auth;

import com.audit.platform.config.AppProperties;
import com.audit.platform.config.JwtTokenProvider;
import com.audit.platform.modules.auth.domain.RefreshToken;
import com.audit.platform.modules.auth.domain.TokenBlacklist;
import com.audit.platform.modules.auth.dto.LoginRequest;
import com.audit.platform.modules.auth.dto.TokenResponse;
import com.audit.platform.modules.auth.repository.RefreshTokenRepository;
import com.audit.platform.modules.auth.repository.TokenBlacklistRepository;
import com.audit.platform.modules.auth.service.AuthService;
import com.audit.platform.modules.user.domain.User;
import com.audit.platform.modules.user.domain.UserRole;
import com.audit.platform.modules.user.domain.UserStatus;
import com.audit.platform.modules.user.repository.UserRepository;
import com.audit.platform.shared.exception.ApiException;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Unit Tests")
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private TokenBlacklistRepository tokenBlacklistRepository;
    @Mock private JwtTokenProvider jwtTokenProvider;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AppProperties appProperties;
    @Mock private org.springframework.security.authentication.AuthenticationManager authenticationManager;
    @Mock private com.audit.platform.modules.audit.service.AuditLogService auditLogService;
    @Mock private org.springframework.beans.factory.ObjectProvider<org.springframework.mail.javamail.JavaMailSender> mailSender;
    @Mock private com.audit.platform.modules.auth.repository.PasswordResetTokenRepository passwordResetTokenRepository;

    @InjectMocks
    private AuthService authService;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(UUID.randomUUID());
        testUser.setEmail("test@audit.com");
        testUser.setPasswordHash("$2a$10$hashedpassword");
        testUser.setRole(UserRole.AUDITOR);
        testUser.setStatus(UserStatus.ACTIVE);
        testUser.setFullName("Test User");
        testUser.setFirstLogin(false);
    }

    private HttpServletRequest mockRequest() {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getRemoteAddr()).thenReturn("127.0.0.1");
        when(req.getHeader("User-Agent")).thenReturn("Mozilla");
        return req;
    }

    @Test
    @DisplayName("Login réussi avec identifiants valides")
    void login_WithValidCredentials_ReturnsTokenResponse() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setEmail("test@audit.com");
        request.setPassword("password123");

        when(userRepository.findByEmailIgnoreCase("test@audit.com")).thenReturn(Optional.of(testUser));
        when(jwtTokenProvider.createAccessToken(any(), any(), any(), anyBoolean())).thenReturn("access-token-xyz");

        AppProperties.Jwt jwtProps = new AppProperties.Jwt();
        jwtProps.setRefreshTokenDays(7);
        when(appProperties.getJwt()).thenReturn(jwtProps);

        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(i -> i.getArgument(0));

        HttpServletRequest req = mockRequest();

        // When
        TokenResponse response = authService.login(request, req);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getAccessToken()).isEqualTo("access-token-xyz");
        assertThat(response.getRefreshToken()).isNotNull();
        verify(refreshTokenRepository).save(any(RefreshToken.class));
        verify(auditLogService).log(any(), eq("LOGIN"), eq("AUTH"), any(), eq(req));
    }

    @Test
    @DisplayName("Login échoue avec utilisateur inconnu")
    void login_WithUnknownUser_ThrowsApiException() {
        // Given
        LoginRequest request = new LoginRequest();
        request.setEmail("unknown@audit.com");
        request.setPassword("password");

        when(userRepository.findByEmailIgnoreCase("unknown@audit.com")).thenReturn(Optional.empty());

        HttpServletRequest req = mockRequest();

        // When / Then
        assertThatThrownBy(() -> authService.login(request, req))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("Login échoue avec compte désactivé")
    void login_WithInactiveAccount_ThrowsApiException() {
        // Given
        testUser.setStatus(UserStatus.INACTIVE);
        LoginRequest request = new LoginRequest();
        request.setEmail("test@audit.com");
        request.setPassword("password123");

        when(userRepository.findByEmailIgnoreCase("test@audit.com")).thenReturn(Optional.of(testUser));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        HttpServletRequest req = mockRequest();

        // When / Then
        assertThatThrownBy(() -> authService.login(request, req))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("Logout blackliste le token")
    void logout_BlacklistsToken() {
        // Given
        String token = "valid-jwt-token";
        Claims claims = mock(Claims.class);
        when(claims.getId()).thenReturn("jti-123");
        when(claims.getExpiration()).thenReturn(java.util.Date.from(Instant.now().plusSeconds(900)));
        when(jwtTokenProvider.parse(token)).thenReturn(claims);
        when(tokenBlacklistRepository.save(any(TokenBlacklist.class))).thenAnswer(i -> i.getArgument(0));

        // When
        authService.logout(token);

        // Then
        verify(tokenBlacklistRepository).save(any(TokenBlacklist.class));
    }
}
