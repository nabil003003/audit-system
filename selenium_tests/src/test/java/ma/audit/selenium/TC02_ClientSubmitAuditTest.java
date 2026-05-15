package ma.audit.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TC-02 : Client se connecte et soumet une demande d'audit
 * URL : /login → /dashboard/client → formulaire "Nouvel Audit"
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TC02_ClientSubmitAuditTest extends BaseTest {

    @Test
    @Order(1)
    @DisplayName("Client : Connexion et redirection vers /dashboard/client")
    void clientLogin() {
        login(CLIENT_EMAIL, CLIENT_PASS);

        assertTrue(driver.getCurrentUrl().contains("/dashboard/client"),
                "Le client doit être redirigé vers /dashboard/client");

        // Vérifier le message de bienvenue
        WebElement hello = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h1[contains(.,'Bonjour')]")
        ));
        assertTrue(hello.isDisplayed());

        System.out.println("✅ Client connecté : " + driver.getCurrentUrl());
    }

    @Test
    @Order(2)
    @DisplayName("Client : Les KPIs du dashboard s'affichent")
    void clientDashboardKpisVisible() {
        login(CLIENT_EMAIL, CLIENT_PASS);

        // Les 4 cartes métriques (Total, En Attente, En Cours, Terminés)
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'Total Audits')]")
        ));
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'En Attente')]")
        ));
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'En Cours')]")
        ));
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'Terminés')]")
        ));

        System.out.println("✅ KPIs dashboard client visibles");
    }

    @Test
    @Order(3)
    @DisplayName("Client : Ouvrir le formulaire Nouvel Audit")
    void clientOpensNewAuditForm() {
        login(CLIENT_EMAIL, CLIENT_PASS);

        // Cliquer "Nouvel Audit"
        WebElement btnNew = wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//button[contains(.,'Nouvel Audit')]")
        ));
        btnNew.click();

        // Vérifier le formulaire
        WebElement formTitle = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Nouvelle demande')]")
        ));
        assertTrue(formTitle.isDisplayed());

        // Champs obligatoires visibles
        assertTrue(driver.findElement(
            By.xpath("//input[@placeholder[contains(.,'Audit comptable')]]")
        ).isDisplayed());

        assertTrue(driver.findElement(
            By.xpath("//textarea[@placeholder[contains(.,'périmètre')]]")
        ).isDisplayed());

        System.out.println("✅ Formulaire Nouvel Audit affiché");
    }

    @Test
    @Order(4)
    @DisplayName("Client : Remplir et soumettre l'audit (sans fichier)")
    void clientSubmitsAuditForm() {
        login(CLIENT_EMAIL, CLIENT_PASS);

        // Ouvrir le formulaire
        wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//button[contains(.,'Nouvel Audit')]")
        )).click();

        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Nouvelle demande')]")
        ));

        // ── Titre ──────────────────────────────────────────────────────────
        WebElement titreInput = driver.findElement(
            By.xpath("//input[@placeholder[contains(.,'Audit comptable')]]")
        );
        titreInput.clear();
        titreInput.sendKeys(AUDIT_TITLE);

        // ── Description ────────────────────────────────────────────────────
        WebElement descInput = driver.findElement(
            By.xpath("//textarea[@placeholder[contains(.,'périmètre')]]")
        );
        descInput.sendKeys(
            "Audit de conformité du contrat de travail aux dispositions du " +
            "Code du Travail marocain (Loi 65-99). " +
            "Vérification des clauses : durée du travail (60h vs 44h légales), " +
            "période d'essai (12 mois vs 3 mois max), congés (10j vs 18j min), SMIG."
        );

        // ── Upload fichier (optionnel - rendre visible via JS) ─────────────
        try {
            WebElement fileInput = driver.findElement(
                By.xpath("//input[@type='file'][@multiple]")
            );
            ((JavascriptExecutor) driver).executeScript(
                "arguments[0].style.display='block'; arguments[0].style.visibility='visible';",
                fileInput
            );
            // Déposer le sample_audit_document.txt fourni dans le projet
            String sampleDoc = "C:\\Users\\SAMSUNG\\Desktop\\Audit_with_rag\\sample_audit_document.txt";
            fileInput.sendKeys(sampleDoc);

            // Vérifier fichier joint
            wait.until(ExpectedConditions.visibilityOfElementLocated(
                By.xpath("//*[contains(.,'sample_audit_document.txt')]")
            ));
            System.out.println("✅ Fichier joint : sample_audit_document.txt");
        } catch (Exception e) {
            System.out.println("⚠️ Upload fichier ignoré : " + e.getMessage());
        }

        // ── Soumettre ──────────────────────────────────────────────────────
        WebElement submitBtn = wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//button[@type='submit'][contains(.,'Soumettre')]")
        ));
        scrollAndClick(submitBtn);

        // Attendre le toast de succès
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//*[contains(.,'Demande soumise') or contains(.,'soumis')]")
        ));

        System.out.println("✅ Audit soumis avec succès : " + AUDIT_TITLE);
    }

    @Test
    @Order(5)
    @DisplayName("Client : L'audit soumis apparaît dans 'Mes Dossiers'")
    void clientVerifiesAuditInList() {
        login(CLIENT_EMAIL, CLIENT_PASS);

        // L'audit doit apparaître dans la liste
        WebElement auditItem = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'" + AUDIT_TITLE.substring(0, 20) + "')]")
        ));
        assertTrue(auditItem.isDisplayed());

        // Statut : En attente ou Brouillon
        WebElement status = driver.findElement(
            By.xpath("//*[contains(.,'En attente') or contains(.,'Brouillon')]")
        );
        assertNotNull(status);

        System.out.println("✅ Audit visible dans Mes Dossiers avec statut : " + status.getText());
    }
}
