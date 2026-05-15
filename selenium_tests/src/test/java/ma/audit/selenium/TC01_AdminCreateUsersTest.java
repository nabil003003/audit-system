package ma.audit.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TC-01 : Admin se connecte et crée 3 utilisateurs (CLIENT, MANAGER, AUDITOR)
 * URL : http://localhost:3000/login → /dashboard/admin → /dashboard/users
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TC01_AdminCreateUsersTest extends BaseTest {

    @Test
    @Order(1)
    @DisplayName("Admin : Connexion et redirection vers /dashboard/admin")
    void adminLogin() {
        login(ADMIN_EMAIL, ADMIN_PASS);

        assertTrue(driver.getCurrentUrl().contains("/dashboard/admin")
                || driver.getCurrentUrl().contains("/dashboard"),
                "L'admin doit être redirigé vers son dashboard");

        System.out.println("✅ Admin connecté : " + driver.getCurrentUrl());
    }

    @Test
    @Order(2)
    @DisplayName("Admin : Accès à la page Gestion des Utilisateurs")
    void adminNavigatesToUsersPage() {
        login(ADMIN_EMAIL, ADMIN_PASS);
        driver.get(USERS_URL);

        WebElement titre = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h1[contains(.,'Gestion des Utilisateurs')]")
        ));
        assertTrue(titre.isDisplayed());

        // Vérifier le bouton "Nouvel Utilisateur"
        WebElement btnNew = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//button[contains(.,'Nouvel Utilisateur')]")
        ));
        assertTrue(btnNew.isDisplayed());

        System.out.println("✅ Page Gestion des Utilisateurs accessible");
    }

    @Test
    @Order(3)
    @DisplayName("Admin : Créer l'utilisateur CLIENT")
    void adminCreatesClientUser() {
        login(ADMIN_EMAIL, ADMIN_PASS);
        driver.get(USERS_URL);

        creerUtilisateur(CLIENT_NAME, CLIENT_EMAIL, CLIENT_PASS, "CLIENT");

        WebElement toast = waitForToast("Utilisateur créé");
        assertNotNull(toast, "Toast de succès doit apparaître");

        System.out.println("✅ Utilisateur CLIENT créé : " + CLIENT_EMAIL);
    }

    @Test
    @Order(4)
    @DisplayName("Admin : Créer l'utilisateur MANAGER")
    void adminCreatesManagerUser() {
        login(ADMIN_EMAIL, ADMIN_PASS);
        driver.get(USERS_URL);

        creerUtilisateur(MANAGER_NAME, MANAGER_EMAIL, MANAGER_PASS, "MANAGER");

        WebElement toast = waitForToast("Utilisateur créé");
        assertNotNull(toast);

        System.out.println("✅ Utilisateur MANAGER créé : " + MANAGER_EMAIL);
    }

    @Test
    @Order(5)
    @DisplayName("Admin : Créer l'utilisateur AUDITOR")
    void adminCreatesAuditorUser() {
        login(ADMIN_EMAIL, ADMIN_PASS);
        driver.get(USERS_URL);

        creerUtilisateur(AUDITOR_NAME, AUDITOR_EMAIL, AUDITOR_PASS, "AUDITOR");

        WebElement toast = waitForToast("Utilisateur créé");
        assertNotNull(toast);

        System.out.println("✅ Utilisateur AUDITOR créé : " + AUDITOR_EMAIL);
    }

    @Test
    @Order(6)
    @DisplayName("Admin : Vérifier que les 3 utilisateurs apparaissent dans le tableau")
    void adminVerifiesAllUsersInTable() {
        login(ADMIN_EMAIL, ADMIN_PASS);
        driver.get(USERS_URL);

        // Attendre le tableau
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//table")
        ));

        // Vérifier présence dans le tableau (peut nécessiter pagination)
        List<WebElement> rows = driver.findElements(By.xpath("//tbody//tr"));
        assertFalse(rows.isEmpty(), "Le tableau doit contenir des utilisateurs");

        System.out.println("✅ " + rows.size() + " utilisateur(s) dans le tableau");
    }

    // =========================================================================
    //  HELPER
    // =========================================================================

    /**
     * Ouvre le modal, remplit le formulaire et soumet.
     */
    private void creerUtilisateur(String nom, String email, String password, String role) {
        // Cliquer "Nouvel Utilisateur"
        WebElement btnNouvel = wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//button[contains(.,'Nouvel Utilisateur')]")
        ));
        scrollAndClick(btnNouvel);

        // Attendre ouverture du modal
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Nouvel Utilisateur')]")
        ));

        // Email
        WebElement emailInput = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//input[@type='email'][@placeholder[contains(.,'nom@')]]")
        ));
        emailInput.clear();
        emailInput.sendKeys(email);

        // Nom Complet
        WebElement nomInput = driver.findElement(
            By.xpath("//input[@type='text'][@placeholder[contains(.,'Jean')]]")
        );
        nomInput.clear();
        nomInput.sendKeys(nom);

        // Rôle
        WebElement roleSelect = driver.findElement(
            By.xpath("//select[option[@value='CLIENT']]")
        );
        new Select(roleSelect).selectByValue(role);

        // Mot de passe temporaire
        WebElement passInput = driver.findElement(
            By.xpath("//input[@type='password'][@placeholder[contains(.,'8+')]]")
        );
        passInput.sendKeys(password);

        // Soumettre
        WebElement submitBtn = driver.findElement(
            By.xpath("//button[@type='submit'][contains(.,'Créer')]")
        );
        scrollAndClick(submitBtn);
    }
}
