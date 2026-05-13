@echo off
:: Авто-коммит и пуш на GitHub
:: Запускайте этот файл после своих правок, либо настройте планировщик задач

cd /d "d:\Приложение для Восторг\salon-crm"

:: Проверяем есть ли изменения
git diff --quiet && git diff --staged --quiet
if %errorlevel% == 0 (
    echo Нет изменений для коммита.
    goto end
)

:: Добавляем всё кроме секретов
git add -A
git status

:: Коммит с датой
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set TODAY=%%c-%%b-%%a
for /f "tokens=1 delims= " %%a in ('time /t') do set NOW=%%a
git commit -m "auto: правки %TODAY% %NOW%"

:: Пушим
git push origin main

echo.
echo Готово! Изменения на GitHub.
:end
pause
