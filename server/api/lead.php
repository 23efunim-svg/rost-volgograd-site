<?php
/**
 * Приём заявок с сайта РОСТ.
 *
 * Порядок важен:
 * 1) отсекаем ботов (honeypot, скорость заполнения, частота с одного IP);
 * 2) пишем лид в CSV — страховка на случай проблем с почтой;
 * 3) отвечаем браузеру ДО отправки письма (sendmail на shared-хостинге держит соединение);
 * 4) только потом шлём письмо через авторизованный SMTP.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Robots-Tag: noindex');
header('X-Content-Type-Options: nosniff');

$CONFIG = [
    'to'       => 'REMOPTSTROYTORG@yandex.ru',
    'to_copy'  => '',
    'from'     => 'site@rem-opt-stroy-torg.ru',
    'site'     => 'rem-opt-stroy-torg.ru',
    'log'      => __DIR__ . '/../leads.csv',
    'rate'     => __DIR__ . '/../.rate',
    'min_fill' => 2500,   // мс: быстрее человек форму не заполнит
    'max_ip'   => 5,      // заявок с одного IP за час
];

$smtpFile = __DIR__ . '/../../smtp.php';
$SMTP = is_readable($smtpFile) ? require $smtpFile : null;

function out(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

function finishRequest(): void
{
    if (function_exists('fastcgi_finish_request')) { fastcgi_finish_request(); return; }
    if (ob_get_level() > 0) { ob_end_flush(); }
    flush();
}

function clean(string $v, int $max = 1000): string
{
    $v = str_replace(["\r", "\n", "\0"], ' ', trim($v));
    $v = preg_replace('/\s+/u', ' ', $v) ?? '';
    return mb_substr($v, 0, $max);
}

/** Не больше N заявок с одного адреса в час: защита от накрутки формы. */
function rateOk(string $file, string $ip, int $max): bool
{
    $now = time();
    $rows = [];
    if (is_readable($file)) {
        foreach (explode("\n", (string) file_get_contents($file)) as $line) {
            [$t, $h] = array_pad(explode(' ', trim($line), 2), 2, '');
            if ($t !== '' && (int) $t > $now - 3600) { $rows[] = [(int) $t, $h]; }
        }
    }
    $mine = 0;
    $hash = substr(hash('sha256', $ip), 0, 16);   // сам адрес не храним
    foreach ($rows as [, $h]) { if ($h === $hash) { $mine++; } }
    if ($mine >= $max) { return false; }
    $rows[] = [$now, $hash];
    @file_put_contents($file, implode("\n", array_map(fn($r) => $r[0] . ' ' . $r[1], $rows)), LOCK_EX);
    return true;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    out(['ok' => false, 'error' => 'method'], 405);
    exit;
}

// honeypot: скрытое поле, человек его не видит
if (!empty($_POST['company'])) { out(['ok' => true]); exit; }

// слишком быстрая отправка = бот
$ts = isset($_POST['ts']) ? (int) $_POST['ts'] : 0;
if ($ts > 0 && (round(microtime(true) * 1000) - $ts) < $CONFIG['min_fill']) {
    out(['ok' => true]);
    exit;
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
if (!rateOk($CONFIG['rate'], $ip, $CONFIG['max_ip'])) {
    out(['ok' => false, 'error' => 'rate'], 429);
    exit;
}

$phoneRaw = preg_replace('/\D/', '', (string) ($_POST['phone'] ?? ''));
if (strlen($phoneRaw) !== 11 || !in_array($phoneRaw[0], ['7', '8'], true)) {
    out(['ok' => false, 'error' => 'phone'], 422);
    exit;
}
$phone = '+7' . substr($phoneRaw, 1);

if (empty($_POST['consent'])) {
    out(['ok' => false, 'error' => 'consent'], 422);
    exit;
}

$lead = [
    'time'    => date('d.m.Y H:i:s'),
    'name'    => clean((string) ($_POST['name'] ?? ''), 120) ?: 'не указано',
    'phone'   => $phone,
    'note'    => clean((string) ($_POST['note'] ?? ''), 2000),
    'channel' => clean((string) ($_POST['channel'] ?? 'Звонок'), 60),
    'source'  => clean((string) ($_POST['source'] ?? ''), 160),
    'page'    => clean((string) ($_POST['page'] ?? ''), 300),
    'utm'     => clean((string) ($_POST['utm'] ?? ''), 500),
    'ip'      => clean($ip, 60),
    'ua'      => clean((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 300),
];

// 1. журнал заявок на сервере, до отправки письма
$isNew = !file_exists($CONFIG['log']);
if ($fh = @fopen($CONFIG['log'], 'a')) {
    if (flock($fh, LOCK_EX)) {
        if ($isNew) {
            fwrite($fh, "\xEF\xBB\xBF");   // BOM, чтобы Excel открыл кириллицу
            fputcsv($fh, ['Дата', 'Имя', 'Телефон', 'Комментарий', 'Способ связи',
                          'Форма', 'Страница', 'Реклама и источник', 'IP'], ';');
        }
        fputcsv($fh, [
            $lead['time'], $lead['name'], $lead['phone'], $lead['note'],
            $lead['channel'], $lead['source'], $lead['page'], $lead['utm'], $lead['ip'],
        ], ';');
        flock($fh, LOCK_UN);
    }
    fclose($fh);
}

// 2. отвечаем браузеру немедленно
out(['ok' => true]);
finishRequest();

// 3. письмо уже после ответа
$subject = 'Заявка с сайта: ' . ($lead['source'] ?: 'форма') . ' — ' . $lead['phone'];
$body = "Новая заявка с сайта {$CONFIG['site']}\n\n"
      . "Имя:            {$lead['name']}\n"
      . "Телефон:        {$lead['phone']}\n"
      . "Способ связи:   {$lead['channel']}\n"
      . 'Комментарий:    ' . ($lead['note'] !== '' ? $lead['note'] : 'нет') . "\n\n"
      . "Форма:          {$lead['source']}\n"
      . "Страница:       https://{$CONFIG['site']}{$lead['page']}\n"
      . 'Реклама:        ' . ($lead['utm'] !== '' ? $lead['utm'] : 'переход без меток') . "\n"
      . "Время:          {$lead['time']}\n"
      . "IP:             {$lead['ip']}\n"
      . "Браузер:        {$lead['ua']}\n";

$sent = false;
if (is_array($SMTP) && !empty($SMTP['host'])) {
    $sent = smtp_send($SMTP, $CONFIG['to'], $subject, $body);
    if ($sent && $CONFIG['to_copy'] !== '') { smtp_send($SMTP, $CONFIG['to_copy'], $subject, $body); }
}
if (!$sent) {
    // запасной путь: без SPF письмо может уйти в спам, поэтому основной путь всё же SMTP
    $headers = "From: РОСТ сайт <{$CONFIG['from']}>\r\n"
             . "Reply-To: {$CONFIG['from']}\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n"
             . "MIME-Version: 1.0\r\n";
    @mail($CONFIG['to'], '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, $headers);
}

/** Минимальный SMTP-клиент с авторизацией: письма не падают в спам. */
function smtp_send(array $cfg, string $to, string $subject, string $body): bool
{
    $host = $cfg['host'];
    $port = (int) ($cfg['port'] ?? 465);
    $secure = $cfg['secure'] ?? 'ssl';
    $fp = @stream_socket_client(($secure === 'ssl' ? 'ssl://' : '') . $host . ':' . $port, $errno, $errstr, 15);
    if (!$fp) { return false; }
    stream_set_timeout($fp, 15);

    $read = function () use ($fp): string {
        $data = '';
        while ($line = fgets($fp, 1024)) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') { break; }
        }
        return $data;
    };
    $cmd = function (string $c) use ($fp, $read): string { fwrite($fp, $c . "\r\n"); return $read(); };

    $read();
    $cmd('EHLO ' . $host);
    if ($secure === 'tls') {
        $cmd('STARTTLS');
        if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) { fclose($fp); return false; }
        $cmd('EHLO ' . $host);
    }
    $cmd('AUTH LOGIN');
    $cmd(base64_encode($cfg['user']));
    if (strpos($cmd(base64_encode($cfg['pass'])), '235') !== 0) { fclose($fp); return false; }

    $cmd('MAIL FROM:<' . $cfg['user'] . '>');
    $cmd('RCPT TO:<' . $to . '>');
    if (strpos($cmd('DATA'), '354') !== 0) { fclose($fp); return false; }

    $headers = 'From: =?UTF-8?B?' . base64_encode('РОСТ, сайт') . "?= <{$cfg['user']}>\r\n"
             . "To: <{$to}>\r\n"
             . 'Subject: =?UTF-8?B?' . base64_encode($subject) . "?=\r\n"
             . 'Date: ' . date('r') . "\r\n"
             . "MIME-Version: 1.0\r\n"
             . "Content-Type: text/plain; charset=UTF-8\r\n"
             . "Content-Transfer-Encoding: base64\r\n";

    $res = $cmd($headers . "\r\n" . chunk_split(base64_encode($body)) . "\r\n.");
    $cmd('QUIT');
    fclose($fp);
    return strpos($res, '250') === 0;
}
