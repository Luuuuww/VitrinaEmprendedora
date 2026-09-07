<?php
$html = file_get_contents(__DIR__ . '/registro.html');

$oldForm = <<<'HTML'
                    <form id="registroForm" class="registro-form">
                        
                        <!-- DATOS DEL EMPRENDEDOR -->
HTML;
$oldForm = str_replace('"', '"', $oldForm);

$accountSection = <<<'HTML'
                    <form id="registroForm" class="registro-form">
                        <div class="form-section account-lookup-section">
                            <h3 class="section-title-form">Cuenta emprendedora</h3>
                            <div class="form-group">
                                <label>Tiene cuenta de emprendedor?</label>
                                <div class="radio-group">
                                    <label class="radio-label">
                                        <input type="radio" name="tieneCuentaEmprendedor" value="no" checked>
                                        <span>No</span>
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" name="tieneCuentaEmprendedor" value="si">
                                        <span>Si</span>
                                    </label>
                                </div>
                            </div>

                            <div class="account-lookup-fields" id="accountLookupFields" hidden>
                                <div class="form-grid">
                                    <div class="form-group">
                                        <label for="cuentaUsuario">Usuario o correo de la cuenta</label>
                                        <input type="email" id="cuentaUsuario" name="cuentaUsuario" autocomplete="username" placeholder="tu@email.com">
                                    </div>
                                    <div class="form-group">
                                        <label for="cuentaPassword">Contrasena de la cuenta</label>
                                        <input type="password" id="cuentaPassword" name="cuentaPassword" autocomplete="current-password" placeholder="Contrasena actual">
                                    </div>
                                </div>
                                <button type="button" class="btn btn-outline" id="loadAccountDataBtn">Cargar mis datos</button>
                                <p class="form-message" id="accountLookupMessage" aria-live="polite"></p>
                            </div>
                        </div>

                        <!-- DATOS DEL EMPRENDEDOR -->
HTML;
$accountSection = str_replace('"', '"', $accountSection);

$oldDescription = <<<'HTML'
<textarea id="descripcionEmprendimiento" name="descripcionEmprendimiento" required rows="4"
HTML;
$newDescription = <<<'HTML'
<textarea id="descripcionEmprendimiento" name="descripcionEmprendimiento" required rows="4" maxlength="250"
HTML;
$oldDescription = str_replace('"', '"', $oldDescription);
$newDescription = str_replace('"', '"', $newDescription);

$oldPlaceholder = <<<'HTML'
placeholder="Describe tu emprendimiento, que productos o servicios ofreces..."></textarea>
HTML;
$newPlaceholder = <<<'HTML'
placeholder="Describe tu emprendimiento, que productos o servicios ofreces..."></textarea>
                                <small><span id="descripcionCounter">0</span>/250 caracteres</small>
HTML;
$oldPlaceholder = str_replace('"', '"', $oldPlaceholder);
$newPlaceholder = str_replace('"', '"', $newPlaceholder);

$oldAccountSection = <<<'HTML'
                        <div class="form-section">
                            <h3 class="section-title-form">Configuracion de Cuenta</h3>
HTML;
$newAccountSection = <<<'HTML'
                        <div class="form-section" id="newAccountSection">
                            <h3 class="section-title-form">Configuracion de Cuenta</h3>
HTML;
$oldAccountSection = str_replace('"', '"', $oldAccountSection);
$newAccountSection = str_replace('"', '"', $newAccountSection);

$oldScript = <<<'HTML'
    <script src="script.js"></script>
HTML;
$newScript = <<<'HTML'
    <script src="script.js"></script>
    <script src="registro-extra.js"></script>
HTML;
$oldScript = str_replace('"', '"', $oldScript);
$newScript = str_replace('"', '"', $newScript);

$oldPasswordCheck = <<<'JS'
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (password !== confirmPassword) {
JS;
$newPasswordCheck = <<<'JS'
            const usaCuentaExistente = document.querySelector('input[name="tieneCuentaEmprendedor"]:checked')?.value === 'si';
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (!usaCuentaExistente && password !== confirmPassword) {
JS;
$newPasswordCheck = str_replace('"', '"', $newPasswordCheck);

$html = str_replace($oldForm, $accountSection, $html);
$html = str_replace($oldDescription, $newDescription, $html);
$html = str_replace($oldPlaceholder, $newPlaceholder, $html);
$html = str_replace($oldAccountSection, $newAccountSection, $html);
$html = str_replace($oldScript, $newScript, $html);
$html = str_replace($oldPasswordCheck, $newPasswordCheck, $html);

header('Content-Type: text/html; charset=utf-8');
echo $html;