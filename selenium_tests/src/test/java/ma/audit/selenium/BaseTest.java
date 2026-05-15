package ma.audit.selenium;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;

/**
 * BaseTest — Configuration commune à tous les tests Selenium AuditPro
 */
public abstract class BaseTest {

    // ── URLs ──────────────────────────────────────────────────────────────────
    protected static final String BASE_URL   = "http://localhost:3000";
    protected static final String LOGIN_URL  = BASE_URL + "/login";
    protected static final String USERS_URL  = BASE_URL + "/dashboard/users";

    // ── Comptes ───────────────────────────────────────────────────────────────
    protected static final String ADMIN_EMAIL   = "nabil@gmail.com";
    protected static final String ADMIN_PASS    = "nabil";

    protected static final String CLIENT_EMAIL  = "client.test@audit.ma";
    protected static final String CLIENT_PASS   = "Client1234!";
    protected static final String CLIENT_NAME   = "Karim Client";

    protected static final String MANAGER_EMAIL = "manager.test@audit.ma";
    protected static final String MANAGER_PASS  = "Manager1234!";
    protected static final String MANAGER_NAME  = "Sara Manager";

    protected static final String AUDITOR_EMAIL = "auditeur.test@audit.ma";
    protected static final String AUDITOR_PASS  = "Auditeur1234!";
    protected static final String AUDITOR_NAME  = "Youssef Auditeur";

    // ── Titre de l'audit créé par le client ───────────────────────────────────
    protected static final String AUDIT_TITLE =
            "Audit Contrat de Travail — Société XYZ Maroc";

    // ── Selenium ──────────────────────────────────────────────────────────────
    protected WebDriver driver;
    protected WebDriverWait wait;
    protected WebDriverWait longWait;

    @BeforeAll
    static void setupDriver() {
        // WebDriverManager télécharge automatiquement ChromeDriver compatible
        WebDriverManager.chromedriver().setup();
    }

    @BeforeEach
    void initDriver() {
        ChromeOptions options = new ChromeOptions();
        // options.addArguments("--headless=new"); // Décommenter pour mode sans fenêtre
        options.addArguments("--no-sandbox");
        options.addArguments("--disable-dev-shm-usage");
        options.addArguments("--window-size=1440,900");

        driver    = new ChromeDriver(options);
        wait      = new WebDriverWait(driver, Duration.ofSeconds(15));
        longWait  = new WebDriverWait(driver, Duration.ofSeconds(90));
        driver.manage().window().maximize();
    }

    @AfterEach
    void quitDriver() {
        if (driver != null) {
            driver.quit();
        }
    }

    // =========================================================================
    //  HELPERS COMMUNS
    // =========================================================================

    /**
     * Se connecter et gérer le premier login (change-password).
     */
    protected void login(String email, String password) {
        driver.get(LOGIN_URL);

        // Attendre le champ email
        wait.until(ExpectedConditions.visibilityOfElementLocated(By.id("email")));
        driver.findElement(By.id("email")).clear();
        driver.findElement(By.id("email")).sendKeys(email);
        driver.findElement(By.id("password")).sendKeys(password);
        driver.findElement(By.id("login-btn")).click();

        // Gérer la redirection change-password (premier login)
        wait.until(d -> d.getCurrentUrl().contains("/dashboard")
                     || d.getCurrentUrl().contains("change-password"));

        if (driver.getCurrentUrl().contains("change-password")) {
            handleChangePassword(password);
        }

        // Attendre dashboard final
        wait.until(ExpectedConditions.urlContains("/dashboard"));
    }

    /**
     * Remplir le formulaire de changement de mot de passe (premier login).
     */
    private void handleChangePassword(String newPassword) {
        java.util.List<WebElement> pwdInputs = wait.until(
            ExpectedConditions.visibilityOfAllElementsLocatedBy(
                By.xpath("//input[@type='password']")
            )
        );
        pwdInputs.get(0).sendKeys(newPassword);
        if (pwdInputs.size() > 1) {
            pwdInputs.get(1).sendKeys(newPassword);
        }
        driver.findElement(By.xpath("//button[@type='submit']")).click();
        wait.until(ExpectedConditions.urlContains("/dashboard"));
    }

    /**
     * Attendre qu'un toast/notification contienne un texte donné.
     */
    protected WebElement waitForToast(String text) {
        return wait.until(ExpectedConditions.visibilityOfElementLocated(
            By.xpath("//*[contains(text(),'" + text + "')]")
        ));
    }

    /**
     * Scroller et cliquer sur un élément (utile pour les boutons hors viewport).
     */
    protected void scrollAndClick(WebElement element) {
        ((JavascriptExecutor) driver).executeScript(
            "arguments[0].scrollIntoView({block:'center'})", element
        );
        wait.until(ExpectedConditions.elementToBeClickable(element)).click();
    }
}
