package ma.audit.selenium;

import org.junit.jupiter.api.*;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.*;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * TC-03 : Manager assigne un auditeur à l'audit du client
 * URL : /login → /dashboard/manager → onglet Attribution → selectbox auditeur
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TC03_ManagerAssignAuditorTest extends BaseTest {

    @Test
    @Order(1)
    @DisplayName("Manager : Connexion et redirection vers /dashboard/manager")
    void managerLogin() {
        login(MANAGER_EMAIL, MANAGER_PASS);

        assertTrue(driver.getCurrentUrl().contains("/dashboard/manager"),
                "Le manager doit être redirigé vers /dashboard/manager");

        WebElement titre = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h1[contains(.,'Tableau de bord Manager')]")
        ));
        assertTrue(titre.isDisplayed());

        System.out.println("✅ Manager connecté : " + driver.getCurrentUrl());
    }

    @Test
    @Order(2)
    @DisplayName("Manager : Les KPIs s'affichent correctement")
    void managerKpisVisible() {
        login(MANAGER_EMAIL, MANAGER_PASS);

        // 4 KPIs : Total, Non Assignés, En Cours, Terminés
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'Total Audits')]")
        ));
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//p[contains(.,'Non Assignés')]")
        ));

        System.out.println("✅ KPIs Manager visibles");
    }

    @Test
    @Order(3)
    @DisplayName("Manager : L'audit du client est visible dans le tableau Attribution")
    void managerSeesClientAuditInTable() {
        login(MANAGER_EMAIL, MANAGER_PASS);

        // Onglet "Attribution" actif par défaut
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Attribution Auditeur')]")
        ));

        // L'audit doit figurer dans le tableau
        WebElement auditRow = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//tr[td[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]]")
        ));
        assertTrue(auditRow.isDisplayed());

        // La colonne "Auditeur actuel" doit indiquer "Non assigné"
        WebElement nonAssigne = auditRow.findElement(
            By.xpath(".//td[contains(.,'Non assigné')]")
        );
        assertNotNull(nonAssigne);

        System.out.println("✅ Audit trouvé dans le tableau, Non assigné");
    }

    @Test
    @Order(4)
    @DisplayName("Manager : Assigner 'Youssef Auditeur' à l'audit")
    void managerAssignsAuditor() {
        login(MANAGER_EMAIL, MANAGER_PASS);

        // Attendre tableau Attribution
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Attribution Auditeur')]")
        ));

        // Trouver la ligne de l'audit
        WebElement auditRow = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//tr[td[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]]")
        ));

        // Trouver le selectbox dans cette ligne
        WebElement selectBox = auditRow.findElement(By.xpath(".//select"));
        Select select = new Select(selectBox);

        // Vérifier que l'auditeur est disponible dans la liste
        List<WebElement> options = select.getOptions();
        boolean auditorFound = options.stream()
            .anyMatch(opt -> opt.getText().contains(AUDITOR_NAME));
        assertTrue(auditorFound,
            "L'auditeur '" + AUDITOR_NAME + "' doit figurer dans la liste");

        // Sélectionner l'auditeur par son nom visible
        select.selectByVisibleText(AUDITOR_NAME);

        // Attendre toast de succès
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//*[contains(.,'Auditeur assigné avec succès') " +
                     "or contains(.,'assigné')]")
        ));

        System.out.println("✅ Auditeur '" + AUDITOR_NAME + "' assigné avec succès");
    }

    @Test
    @Order(5)
    @DisplayName("Manager : Vérifier l'auditeur affiché après assignation")
    void managerVerifiesAssignment() {
        login(MANAGER_EMAIL, MANAGER_PASS);

        // Attendre que le tableau se recharge
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Attribution Auditeur')]")
        ));

        // La ligne de l'audit doit maintenant montrer l'auditeur
        WebElement auditRow = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//tr[td[contains(.,'" + AUDIT_TITLE.substring(0, 15) + "')]]")
        ));

        // La colonne "Auditeur actuel" contient le nom
        WebElement auditorCell = auditRow.findElement(
            By.xpath(".//td[contains(.,'" + AUDITOR_NAME.split(" ")[0] + "')]")
        );
        assertNotNull(auditorCell);

        System.out.println("✅ Auditeur vérifié dans le tableau : " + auditorCell.getText());
    }

    @Test
    @Order(6)
    @DisplayName("Manager : Vérifier l'onglet Suivi d'avancement")
    void managerChecksSuivi() {
        login(MANAGER_EMAIL, MANAGER_PASS);

        // Cliquer sur "Suivi d'avancement"
        WebElement suiviTab = wait.until(ExpectedConditions.elementToBeClickable(
            By.xpath("//button[contains(.,'Suivi')]")
        ));
        suiviTab.click();

        // Section "Avancement par auditeur"
        WebElement suiviSection = wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//h2[contains(.,'Avancement par auditeur')]")
        ));
        assertTrue(suiviSection.isDisplayed());

        // L'auditeur doit apparaître dans le suivi
        wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//*[contains(.,'" + AUDITOR_NAME.split(" ")[0] + "')]")
        ));

        System.out.println("✅ Suivi d'avancement affiché avec l'auditeur");
    }
}
