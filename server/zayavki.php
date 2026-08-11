<?php
/**
 * Журнал заявок для менеджера: /zayavki.php
 *
 * Вход по паролю из файла вне корня сайта (../lead-pass.php). Пароль хранится
 * хешем, в открытом виде нигде не лежит. Скачивание в CSV для Excel и Google Таблиц.
 */
declare(strict_types=1);
session_start();

header('X-Robots-Tag: noindex, nofollow');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

$CSV     = __DIR__ . '/leads.csv';
$PASSF   = __DIR__ . '/../lead-pass.php';   // ['hash' => '...'] из password_hash
$TRIES   = __DIR__ . '/.login-tries';
$MAXTRY  = 8;                               // попыток входа за 15 минут

$conf = is_readable($PASSF) ? require $PASSF : null;
$hash = is_array($conf) ? ($conf['hash'] ?? '') : '';

/** Тормозим перебор пароля: не больше MAXTRY попыток за 15 минут с адреса. */
function tries(string $file, string $ip, int $max): bool
{
    $now = time();
    $keep = [];
    if (is_readable($file)) {
        foreach (explode("\n", (string) file_get_contents($file)) as $l) {
            [$t, $h] = array_pad(explode(' ', trim($l), 2), 2, '');
            if ($t !== '' && (int) $t > $now - 900) { $keep[] = [(int) $t, $h]; }
        }
    }
    $me = substr(hash('sha256', $ip), 0, 16);
    $n = 0;
    foreach ($keep as [, $h]) { if ($h === $me) { $n++; } }
    if ($n >= $max) { return false; }
    $keep[] = [$now, $me];
    @file_put_contents($file, implode("\n", array_map(fn($r) => $r[0] . ' ' . $r[1], $keep)), LOCK_EX);
    return true;
}

$err = '';
if (isset($_POST['pass'])) {
    if (!tries($TRIES, (string) ($_SERVER['REMOTE_ADDR'] ?? ''), $MAXTRY)) {
        $err = 'Слишком много попыток. Попробуйте через пятнадцать минут.';
    } elseif ($hash !== '' && password_verify((string) $_POST['pass'], $hash)) {
        session_regenerate_id(true);
        $_SESSION['rost_leads'] = true;
    } else {
        $err = 'Пароль не подошёл.';
    }
}
if (isset($_GET['exit'])) { session_destroy(); header('Location: zayavki.php'); exit; }

$auth = !empty($_SESSION['rost_leads']);

// выгрузка файла целиком
if ($auth && isset($_GET['csv']) && is_readable($CSV)) {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="zayavki-' . date('Y-m-d') . '.csv"');
    readfile($CSV);
    exit;
}

$rows = [];
if ($auth && is_readable($CSV)) {
    if ($fh = fopen($CSV, 'r')) {
        while (($r = fgetcsv($fh, 0, ';')) !== false) { $rows[] = $r; }
        fclose($fh);
    }
    if ($rows) {
        $rows[0][0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $rows[0][0]);
        $head = array_shift($rows);
        $rows = array_reverse($rows);   // свежие сверху
    }
}
$head = $head ?? [];
$today = 0;
foreach ($rows as $r) { if (str_starts_with((string) ($r[0] ?? ''), date('d.m.Y'))) { $today++; } }
?><!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Заявки с сайта · РОСТ</title>
<style>
  :root { --bg:#0D0D0E; --pa:#17171A; --tx:#E8E5DF; --mut:#94918B; --br:#B08D57; --ln:rgba(232,229,223,.13); }
  * { box-sizing:border-box }
  body { margin:0; background:var(--bg); color:var(--tx); font:15px/1.55 system-ui,-apple-system,'Segoe UI',sans-serif; }
  .w { width:min(100% - 2rem, 1240px); margin:0 auto; padding:1.4rem 0 3rem }
  h1 { font-size:1.3rem; font-weight:600; margin:0 0 .2rem }
  .sub { color:var(--mut); font-size:.85rem; margin-bottom:1.4rem }
  .bar { display:flex; flex-wrap:wrap; gap:.6rem; align-items:center; margin-bottom:1rem }
  .btn { display:inline-block; padding:.5rem 1rem; border:1px solid var(--br); color:var(--br);
         background:transparent; border-radius:2px; font-size:.85rem; cursor:pointer; text-decoration:none }
  .btn:hover { background:var(--br); color:var(--bg) }
  .stat { margin-left:auto; color:var(--mut); font-size:.85rem }
  .stat b { color:var(--br); font-weight:600 }
  table { width:100%; border-collapse:collapse; font-size:.82rem }
  th,td { text-align:left; padding:.55rem .7rem; border-bottom:1px solid var(--ln); vertical-align:top }
  th { color:var(--mut); font-weight:600; font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; position:sticky; top:0; background:var(--bg) }
  tr:hover td { background:var(--pa) }
  td a { color:var(--br); font-weight:600; text-decoration:none; white-space:nowrap }
  .box { max-width:340px; margin:12vh auto; padding:1.6rem; border:1px solid var(--ln); border-radius:4px; background:var(--pa) }
  .box h1 { margin-bottom:1rem }
  input[type=password] { width:100%; padding:.6rem .8rem; margin-bottom:.7rem; background:transparent;
                         border:1px solid var(--ln); border-radius:2px; color:var(--tx); font:inherit }
  .err { color:#D07A68; font-size:.85rem; margin-bottom:.7rem }
  .empty { color:var(--mut); padding:2rem 0 }
  .wrapt { overflow-x:auto }
</style>
</head>
<body>
<?php if (!$auth): ?>
  <div class="box">
    <h1>Заявки с сайта</h1>
    <?php if ($err): ?><p class="err"><?= htmlspecialchars($err) ?></p><?php endif; ?>
    <?php if ($hash === ''): ?>
      <p class="err">Файл с паролем не найден. Создайте <code>lead-pass.php</code> на уровень выше корня сайта, см. DEPLOY.md.</p>
    <?php else: ?>
      <form method="post">
        <input type="password" name="pass" placeholder="Пароль" autofocus required>
        <button class="btn" type="submit">Войти</button>
      </form>
    <?php endif; ?>
  </div>
<?php else: ?>
  <div class="w">
    <h1>Заявки с сайта</h1>
    <p class="sub">Свежие сверху. Файл лежит на сервере и пополняется даже если почта не дошла.</p>
    <div class="bar">
      <a class="btn" href="?csv=1">Скачать CSV для Excel и Google&nbsp;Таблиц</a>
      <a class="btn" href="?exit=1">Выйти</a>
      <span class="stat">Всего <b><?= count($rows) ?></b> · сегодня <b><?= $today ?></b></span>
    </div>

    <?php if (!$rows): ?>
      <p class="empty">Заявок пока нет.</p>
    <?php else: ?>
      <div class="wrapt">
      <table>
        <thead><tr><?php foreach ($head as $h): ?><th><?= htmlspecialchars((string) $h) ?></th><?php endforeach; ?></tr></thead>
        <tbody>
        <?php foreach ($rows as $r): ?>
          <tr>
            <?php foreach ($r as $i => $c): $c = (string) $c; ?>
              <td><?php
                if ($i === 2 && $c !== '') {
                    echo '<a href="tel:' . htmlspecialchars(preg_replace('/\D/', '', $c)) . '">' . htmlspecialchars($c) . '</a>';
                } else {
                    echo nl2br(htmlspecialchars($c));
                }
              ?></td>
            <?php endforeach; ?>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
      </div>
    <?php endif; ?>
  </div>
<?php endif; ?>
</body>
</html>
