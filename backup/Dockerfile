FROM postgres:18-alpine
RUN apk add --no-cache aws-cli python3
WORKDIR /backup
COPY backup.py aws-config ./
ENV AWS_CONFIG_FILE=/backup/aws-config AWS_PAGER="" AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
ENTRYPOINT ["python3", "/backup/backup.py"]
