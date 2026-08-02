@echo off
title Servidor Python - Jogo da Trilha
echo ===================================================
echo   Iniciando o Servidor Python para o Jogo da Trilha
echo ===================================================
echo.
echo Abrindo o navegador em http://localhost:8001...
echo.

:: Abre o navegador no endereco da porta 8001
start http://localhost:8001

:: Inicia o servidor HTTP nativo do Python na porta 8001
python -m http.server 8001

pause