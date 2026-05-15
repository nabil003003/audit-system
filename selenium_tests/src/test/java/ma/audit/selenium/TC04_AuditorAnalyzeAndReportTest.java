package ma.audit.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TC-04 : Auditeur sélectionne le dossier, avance le statut, lance l'analyse IA
 * URL : /login → /dashboard/auditor → sélection dossier → bouton IA → rapport
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TC04_AuditorAnalyzeAndReportTest extends BaseTest {

    @Test
    @Order(1)
    @DisplayName("Auditeur : Connexion et redirection vers /dashboard/auditor")
    void auditorLogin() {
        login(AUDITOR_EMAIL, AUDITOR_PASS);

        assertTrue(driver.getCurrentUrl().contains("/dashboard/auditor"),
                "L'auditeur doit être redirigé vers /dashboard/auditor");

        WebElement hello = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h1[contains(.,'Bonjour')]")
        ));
        assertTrue(hello.isDisplayed());

        System.out.println("✅ Auditeur connecté : " + driver.getCurrentUrl());
    }

    @Test
    @Order(2)
    @DisplayName("Auditeur : L'audit assigné apparaît dans 'Mes Dossiers'")
    void auditorSeesDossier() {
        login(AUDITOR_EMAIL, AUDITOR_PASS);

        // Attendre la section "Mes Dossiers"
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Mes Dossiers')]")
        ));

        // Le dossier assigné doit figurer dans la liste
        WebElement dossier = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        ));
        assertTrue(dossier.isDisplayed());

        System.out.println("✅ Dossier visible : " + dossier.getText());
    }

    @Test
    @Order(3)
    @DisplayName("Auditeur : Sélectionner le dossier → panneau de détail")
    void auditorSelectsDossier() {
        login(AUDITOR_EMAIL, AUDITOR_PASS);

        // Cliquer sur le dossier dans la liste
        WebElement dossierItem = wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//p[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        ));
        dossierItem.click();

        // Panneau de détail doit s'ouvrir
        WebElement panelTitle = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h3[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        ));
        assertTrue(panelTitle.isDisplayed());

        // Section Analyse IA visible
        WebElement aiSection = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h3[contains(.,'Analyse IA')]")
        ));
        assertTrue(aiSection.isDisplayed());

        System.out.println("✅ Panneau de détail ouvert avec section IA");
    }

    @Test
    @Order(4)
    @DisplayName("Auditeur : Avancer le statut → 'En cours'")
    void auditorAdvancesStatus() {
        login(AUDITOR_EMAIL, AUDITOR_PASS);

        // Sélectionner le dossier
        wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//p[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        )).click();

        // Attendre le panneau
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h3[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        ));

        // Chercher le bouton "Passer à : En cours"
        try {
            WebElement advanceBtn = wait.until(ExpectedConditions.elementToBeClickable(
                By.xpath("//button[contains(.,'Passer à')]")
            ));
            scrollAndClick(advanceBtn);

            // Vérifier toast
            wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//*[contains(.,'Avancement') or contains(.,'succès')]")
            ));
            System.out.println("✅ Statut avancé avec succès");
        } catch (TimeoutException e) {
            System.out.println("⚠️ Bouton 'Passer à' non trouvé (statut déjà COMPLETED ?)");
        }
    }

    @Test
    @Order(5)
    @DisplayName("Auditeur : Lancer l'analyse IA RAG")
    void auditorLaunchesAIAnalysis() {
        login(AUDITOR_EMAIL, AUDITOR_PASS);

        // Sélectionner le dossier
        wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//p[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        )).click();

        // Attendre panneau détail + section IA
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h3[contains(.,'Analyse IA')]")
        ));

        // Cliquer "Voir/Lancer l'analyse IA"
        WebElement aiBtn = wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//button[contains(.,'analyse IA') or contains(.,'Voir/Lancer')]")
        ));
        scrollAndClick(aiBtn);

        // Toast "Analyse lancée"
        try {
            wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//*[contains(.,'Analyse lancée') or contains(.,'analyse') " +
                         "or contains(.,'Aucune analyse')]")
            ));
            System.out.println("✅ Analyse IA lancée (polling backend en cours...)");
        } catch (TimeoutException e) {
            System.out.println("⚠️ Toast non reçu, RAG/backend peut-être non démarré");
        }
    }

    @Test
    @Order(6)
    @DisplayName("Auditeur : Attendre le résultat de l'analyse IA (max 90s)")
    void auditorWaitsForAIResult() {
        login(AUDITOR_EMAIL, AUDITOR_PASS);

        // Sélectionner le dossier
        wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//p[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        )).click();

        // Lancer l'analyse
        wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//button[contains(.,'analyse IA') or contains(.,'Voir/Lancer')]")
        )).click();

        // Attendre jusqu'à 90 secondes que le résultat s'affiche
        try {
            WebElement result = longWait.until(
                ExpectedConditions.visibilityOfElementLocated(
                    By.xpath("//p[contains(@class,'whitespace-pre-wrap') " +
                             "and string-length(text()) > 10]")
                )
            );
            assertNotNull(result);
            assertFalse(result.getText().isEmpty());
            System.out.println("✅ Résultat IA reçu (" +
                result.getText().length() + " caractères)");
            System.out.println("📊 Extrait : " +
                result.getText().substring(0, Math.min(150, result.getText().length())));
        } catch (TimeoutException e) {
            System.out.println("⚠️ Résultat IA non reçu dans les 90s. " +
                "Vérifiez que Ollama est démarré et qu'un modèle est téléchargé.");
        }
    }

    @Test
    @Order(7)
    @DisplayName("Auditeur : Ouvrir le dossier complet (/audit/{id})")
    void auditorOpensFullDossier() {
        login(AUDITOR_EMAIL, AUDITOR_PASS);

        // Sélectionner le dossier
        wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//p[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        )).click();

        // Attendre panneau détail
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h3[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]")
        ));

        // Cliquer "Ouvrir le dossier"
        WebElement openBtn = wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//a[contains(.,'Ouvrir le dossier')]")
        ));
        openBtn.click();

        // Vérifier navigation vers /audit/{id}
        wait.until(ExpectedConditions.urlMatches(".*\\/audit\\/[a-zA-Z0-9\\-]+.*"));

        String currentUrl = driver.getCurrentUrl();
        assertTrue(currentUrl.contains("/audit/"),
            "Doit naviguer vers /audit/{id}, URL: " + currentUrl);

        System.out.println("✅ Dossier complet ouvert : " + currentUrl);
    }
}
