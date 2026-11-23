-- Execute uma única vez em bancos criados com a versão anterior do schema.
-- CNPJs existentes ficam NULL até serem revisados; novas contas empresariais
-- são validadas pela API e devem sempre informar um CNPJ com dígitos válidos.
ALTER TABLE companies
  ADD COLUMN cnpj VARCHAR(14) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER name;

CREATE UNIQUE INDEX uq_companies_cnpj ON companies (cnpj);
