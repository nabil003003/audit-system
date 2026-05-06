package com.audit.platform.modules.user;

import com.audit.platform.modules.user.domain.User;
import com.audit.platform.modules.user.domain.UserRole;
import com.audit.platform.modules.user.domain.UserStatus;
import com.audit.platform.modules.user.dto.CreateUserRequest;
import com.audit.platform.modules.user.dto.UserResponse;
import com.audit.platform.modules.user.repository.UserRepository;
import com.audit.platform.modules.user.service.UserService;
import com.audit.platform.shared.exception.ApiException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserService Unit Tests")
class UserServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private ObjectProvider<JavaMailSender> mailSender;

    @InjectMocks
    private UserService userService;

    private User adminUser;
    private User existingUser;

    @BeforeEach
    void setUp() {
        adminUser = new User();
        adminUser.setId(UUID.randomUUID());
        adminUser.setRole(UserRole.ADMIN);
        adminUser.setEmail("admin@audit.com");
        adminUser.setFullName("Admin");

        existingUser = new User();
        existingUser.setId(UUID.randomUUID());
        existingUser.setEmail("user@audit.com");
        existingUser.setRole(UserRole.AUDITOR);
        existingUser.setStatus(UserStatus.ACTIVE);
        existingUser.setFullName("Auditeur Existing");
    }

    @Test
    @DisplayName("Création d'un nouvel utilisateur par l'admin")
    void createUser_ByAdmin_Succeeds() {
        // Given
        CreateUserRequest request = new CreateUserRequest();
        request.setEmail("newaudit@audit.com");
        request.setFullName("New Auditor");
        request.setRole(UserRole.AUDITOR);
        request.setTemporaryPassword("TempPass123!");

        when(userRepository.existsByEmailIgnoreCase("newaudit@audit.com")).thenReturn(false);
        when(userRepository.findById(adminUser.getId())).thenReturn(Optional.of(adminUser));
        when(passwordEncoder.encode("TempPass123!")).thenReturn("$2a$10$hashed");
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            u.setId(UUID.randomUUID());
            return u;
        });

        // When
        UserResponse response = userService.createUser(request, adminUser.getId());

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getEmail()).isEqualTo("newaudit@audit.com");
        assertThat(response.isFirstLogin()).isTrue();
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("Création échoue si email déjà existant")
    void createUser_DuplicateEmail_ThrowsApiException() {
        // Given
        CreateUserRequest request = new CreateUserRequest();
        request.setEmail("user@audit.com");
        request.setFullName("Duplicate");
        request.setRole(UserRole.AUDITOR);
        request.setTemporaryPassword("Pass123!");

        when(userRepository.existsByEmailIgnoreCase("user@audit.com")).thenReturn(true);

        // When / Then
        assertThatThrownBy(() -> userService.createUser(request, adminUser.getId()))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("Désactivation d'un utilisateur actif via toggleStatus")
    void toggleStatus_ActiveUser_SetsInactive() {
        // Given
        when(userRepository.findById(existingUser.getId())).thenReturn(Optional.of(existingUser));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        // When
        userService.toggleStatus(existingUser.getId());

        // Then
        assertThat(existingUser.getStatus()).isEqualTo(UserStatus.INACTIVE);
        verify(userRepository).save(existingUser);
    }
}
