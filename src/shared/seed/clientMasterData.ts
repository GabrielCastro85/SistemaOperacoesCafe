export interface ClientMasterDataEntry {
  displayName: string;
  notes: string | null;
  isActive: boolean;
  creditLimitCents: number | null;
  roles: string[];
  legalEntities: Array<{
    legalName: string;
    tradeName: string;
    cnpj: string | null;
    stateRegistration: string | null;
    municipalRegistration: string | null;
    email: string | null;
    phone: string | null;
    addressLine: string | null;
    addressNumber: string | null;
    addressComplement: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    isPrimary: boolean;
    isActive: boolean;
    isDraft: boolean;
  }>;
  contacts: Array<{
    name: string;
    department: string | null;
    email: string | null;
    phone: string | null;
    mobile: string | null;
    preferredContactMethod: string;
    isPrimary: boolean;
    notes: string | null;
    isActive: boolean;
  }>;
}

export const clientMasterData = [
  {
    "displayName": "2 J COMERCIAL LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 4.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "2 J COMERCIAL LTDA",
        "tradeName": "2 J COMERCIAL LTDA",
        "cnpj": "42762204000100",
        "stateRegistration": "083789820",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO DA PENHA",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "NOVA VENECIA",
        "state": "ES",
        "postalCode": "29830000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "7 IRMAOS CAFES DO BRASIL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 147.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "7 IRMAOS CAFES DO BRASIL LTDA",
        "tradeName": "M.M. ASSOCIADOS",
        "cnpj": "02287926000135",
        "stateRegistration": "0047226130033",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA LINCON WESTIN DA SILVEIRA",
        "addressNumber": "4370",
        "addressComplement": null,
        "district": "VILA SANTA EDWIRGES",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37137516",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "A ABRANTES GADELHA CIA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 41.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "A ABRANTES GADELHA CIA",
        "tradeName": "A ABRANTES GADELHA CIA",
        "cnpj": "09505777000182",
        "stateRegistration": "160108721",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ANA  ABRANTES  GADELHA",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "JARDIM  IRACEMA",
        "city": "SOUSA",
        "state": "PB",
        "postalCode": "58806000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "A K TRADING LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 75.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "A K TRADING LTDA",
        "tradeName": "A K TRADING LTDA",
        "cnpj": "51320842000161",
        "stateRegistration": "46583010038",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA MINAS GERAIS",
        "addressNumber": "605",
        "addressComplement": null,
        "district": "REZENDE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37062193",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "A R DE ARAUJO ARMAZENS",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 188.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "A R DE ARAUJO ARMAZENS",
        "tradeName": "CAFEEIRA ARAUJO",
        "cnpj": "43816828000125",
        "stateRegistration": "0041689690003",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO DO PERIGOSO",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SANTA RITA DE MINAS",
        "state": "MG",
        "postalCode": "35326000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ABC ARMAZEM BRASILEIRO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 413.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ABC ARMAZEM BRASILEIRO DE CAFE LTDA",
        "tradeName": "ABC ARMAZEM BRASILEIRO DE CAFE",
        "cnpj": "54235962000159",
        "stateRegistration": "137113556113",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA FELIPE CALIXTO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "FRANCA",
        "state": "SP",
        "postalCode": "14414899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGRO COFFEE COMERCIO IMPORTACAO S.A.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 466.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 30.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGRO COFFEE COMERCIO IMPORTACAO S.A.",
        "tradeName": "AGRO COFFEE COMERCIO IMPORTACAO S.A.",
        "cnpj": "18317171000104",
        "stateRegistration": "0021683040023",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR-491",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "FAUSTO RIBEIRO",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37062405",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGRO FONTE ALTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 120.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGRO FONTE ALTA LTDA",
        "tradeName": "ARMAZEM CAFE DA FONTE",
        "cnpj": "09412302000737",
        "stateRegistration": "0014025710528",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 267",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ACUDE",
        "city": "CAMPESTRE",
        "state": "MG",
        "postalCode": "37730000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGRO FORTE IMPORTACAO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 184.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGRO FORTE IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "AGRO FORTE",
        "cnpj": "37751634000196",
        "stateRegistration": "0037825800028",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MANOEL MADEIRA",
        "addressNumber": "67",
        "addressComplement": null,
        "district": "INDUSTRIAL REINALDO FORESTI",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026560",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGRO ITALIA COMERCIO E SERVICOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 165.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGRO ITALIA COMERCIO E SERVICOS LTDA",
        "tradeName": "AGRO ITALIA COMERCIO E SERVICO",
        "cnpj": "19740527000180",
        "stateRegistration": "0025890450026",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA FARIA PEREIRA",
        "addressNumber": "621",
        "addressComplement": null,
        "district": "NACOES",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38745098",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGRO MINAS NORDESTE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 419.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGRO MINAS NORDESTE LTDA",
        "tradeName": "AGRO MINAS NORDESTE",
        "cnpj": "46464379000191",
        "stateRegistration": "0043524530010",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO SOLEDADE",
        "addressNumber": "01",
        "addressComplement": null,
        "district": "AREA RURAL DE MANHUACU",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36908899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGRONEGOCIO DEMUNER LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 29.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGRONEGOCIO DEMUNER LTDA",
        "tradeName": "AGRONEGOCIO DEMUNER LTDA",
        "cnpj": "45498247000118",
        "stateRegistration": "083869778",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ESTRADA SANTA JULIA",
        "addressNumber": "0",
        "addressComplement": null,
        "district": "SANTA JULIA",
        "city": "SAO ROQUE DO CANAA",
        "state": "ES",
        "postalCode": "29665000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGROSARTO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 175.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGROSARTO LTDA",
        "tradeName": "AGROSARTO REPRESENTACOES E ARM",
        "cnpj": "03470880000158",
        "stateRegistration": "0022390610030",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JURANA",
        "addressNumber": "215",
        "addressComplement": null,
        "district": "RESIDENCIAL TEIXEIRA",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37132360",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGUIA COMERCIO IMPORTACAO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 260.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGUIA COMERCIO IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "AGUIA COMERCIO IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "cnpj": "27189781000160",
        "stateRegistration": "0029209420080",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA TUPARI",
        "addressNumber": "74",
        "addressComplement": null,
        "district": "RESIDENCIAL TEIXEIRA",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37132354",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AGUIAR COMERCIAL E BENEFICIAMENTO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 74.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AGUIAR COMERCIAL E BENEFICIAMENTO LTDA",
        "tradeName": "AGUIAR COMERCIAL E BENEFICIAME",
        "cnpj": "54763538000187",
        "stateRegistration": "0048710760024",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R EDIPO MONTEIRO CASTANHEIRA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "VILA JARDIM N. S. DE FATIMA",
        "city": "SAO JOAO DEL REI",
        "state": "MG",
        "postalCode": "36305326",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ALAMEDA DO CAFE ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 189.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ALAMEDA DO CAFE ARMAZENS GERAIS LTDA",
        "tradeName": "ALAMEDA DO CAFE ARMAZENS GERAIS LTDA",
        "cnpj": "20985564000138",
        "stateRegistration": "0024256290010",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ALAMEDA DO CAFE",
        "addressNumber": "805",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026400",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ALCE PARTICIPACOES E EMPREENDIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 461.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ALCE PARTICIPACOES E EMPREENDIMENTOS LTDA",
        "tradeName": "ALCE PARTICIPACOES E EMPREENDI",
        "cnpj": "63662830000102",
        "stateRegistration": "0053577190094",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SANTO AMARO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "AREA RURAL DE MANHUACU",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36908899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ALECIO GOTTI LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 443.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ALECIO GOTTI LTDA",
        "tradeName": "CAFE PRIMAVERA",
        "cnpj": "51904027000140",
        "stateRegistration": "374004971112",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA CASTRO ALVES",
        "addressNumber": "34",
        "addressComplement": null,
        "district": "BOA VISTA",
        "city": "ITAPIRA",
        "state": "SP",
        "postalCode": "13974503",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ALIANCA EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 186.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ALIANCA EXPORTACAO DE CAFE LTDA",
        "tradeName": "ALIANCA CAFE",
        "cnpj": "13216943000289",
        "stateRegistration": "537060526110",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA VEREADOR MILTON SPINOLA",
        "addressNumber": "310",
        "addressComplement": null,
        "district": "VILA CAMPOS",
        "city": "PIRAJU",
        "state": "SP",
        "postalCode": "18803192",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ALL COFFEE BRASIL COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 310.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ALL COFFEE BRASIL COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "ALL COFFEE",
        "cnpj": "50415034000115",
        "stateRegistration": "0046006390051",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "PRACA MONSENHOR MESSIAS BRAGANCA",
        "addressNumber": "80",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "PASSOS",
        "state": "MG",
        "postalCode": "37900084",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "AMA REPRESENTACOES DE PRODUTOS ALIMENTICIOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 2.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "AMA REPRESENTACOES DE PRODUTOS ALIMENTICIOS LTDA",
        "tradeName": "AMA REPRESENTACOES DE PRODUTOS ALIMENTICIOS LTDA",
        "cnpj": "26440243000304",
        "stateRegistration": "530117160117",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R RACHID ELIAS SOBRINHO",
        "addressNumber": "210",
        "addressComplement": null,
        "district": "JD MONTE ALEGRE",
        "city": "ESPIRITO SANTO DO PINHAL",
        "state": "SP",
        "postalCode": "13990000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ANJU INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 52.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ANJU INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "ANJU INDUSTRIA E COMERCIO DE CAFE LTDA",
        "cnpj": "08483483000134",
        "stateRegistration": "255303238",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DR. GETULIO VARGAS",
        "addressNumber": "2620",
        "addressComplement": null,
        "district": "BELA VISTA",
        "city": "IBIRAMA",
        "state": "SC",
        "postalCode": "89140000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ANM COMERCIO ATACADISTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 6.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ANM COMERCIO ATACADISTA LTDA",
        "tradeName": "ANM COMERCIO ATACADISTA LTDA",
        "cnpj": "50378028000135",
        "stateRegistration": "0045983200062",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R VEREADOR ADEMIR CERDEIRA CABIDO",
        "addressNumber": "74",
        "addressComplement": null,
        "district": "IMPERIAL",
        "city": "TOCANTINS",
        "state": "MG",
        "postalCode": "36512000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ANM COMERCIO ATACADISTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 84.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ANM COMERCIO ATACADISTA LTDA",
        "tradeName": "ANM COMERCIO ATACADISTA LTDA",
        "cnpj": "50378028000216",
        "stateRegistration": "135741160114",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA PAULISTA",
        "addressNumber": "777",
        "addressComplement": null,
        "district": "BELA VISTA",
        "city": "SAO PAULO",
        "state": "SP",
        "postalCode": "13119140",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ANTONIO DE LIMA CAMPOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 65.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ANTONIO DE LIMA CAMPOS LTDA",
        "tradeName": "ALC TRANSPORTES",
        "cnpj": "97545548000159",
        "stateRegistration": "0018044460020",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA IRMA RENEE",
        "addressNumber": "265",
        "addressComplement": null,
        "district": "SAO VICENTE",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38740001",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARABICA MINEIRO COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 66.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARABICA MINEIRO COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "ARABICA MINEIRO COMERCIO E EXPORTACAO DE CAFE LTDA",
        "cnpj": "19611645000199",
        "stateRegistration": "0022986370080",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MANOEL FRANCISCO RATO",
        "addressNumber": "112",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "MONTE BELO",
        "state": "MG",
        "postalCode": "37115000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZEM GERAIS SAO PEDRO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 453.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZEM GERAIS SAO PEDRO LTDA",
        "tradeName": "ARMAZEM GERAIS SAO PEDRO LTDA",
        "cnpj": "02398375000187",
        "stateRegistration": "0267372080092",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SITIO SAO SEBASTIAO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SERRA DOS LIMA",
        "city": "ANDRADAS",
        "state": "MG",
        "postalCode": "37795000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS ANDRADE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 15.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS ANDRADE LTDA",
        "tradeName": "ARMAZENS GERAIS ANDRADE",
        "cnpj": "09041929000133",
        "stateRegistration": "0010424510049",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE FORTUNATO FILHO",
        "addressNumber": "265",
        "addressComplement": null,
        "district": "CAMPO VERDE",
        "city": "IBIRACI",
        "state": "MG",
        "postalCode": "37990000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS DEBOCA EIRELI",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 195.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS DEBOCA EIRELI",
        "tradeName": "ARMAZENS GERAIS DEBOCA EIRELI",
        "cnpj": "18206612000109",
        "stateRegistration": "0021573750050",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MIGUEL TOLEDO",
        "addressNumber": "21",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CAIANA",
        "state": "MG",
        "postalCode": "36800000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS GRAO DE MINAS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 409.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS GRAO DE MINAS LTDA",
        "tradeName": "ARMAZENS GERAIS GRAO DE MINAS LTDA",
        "cnpj": "17982192000181",
        "stateRegistration": "0021362620017",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA VITORIO JACOB",
        "addressNumber": "595",
        "addressComplement": null,
        "district": "BARBA DE BODE",
        "city": "NOVA RESENDE",
        "state": "MG",
        "postalCode": "37860000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS ITAMOGI LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 318.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS ITAMOGI LTDA",
        "tradeName": "A. GERAIS ITAMOGI LTDA CNPJ: 0",
        "cnpj": "02508528000100",
        "stateRegistration": "3297389340035",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ACESSO A BR-491, KM 5,5",
        "addressNumber": "477",
        "addressComplement": null,
        "district": "ESTACAO",
        "city": "ITAMOGI",
        "state": "MG",
        "postalCode": "37973000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS JR LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 211.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS JR LTDA",
        "tradeName": "AMAZENS GERAIS JR LTDA",
        "cnpj": "60575431000108",
        "stateRegistration": "0051836360053",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA OSWALDO GONTIJO",
        "addressNumber": "20",
        "addressComplement": null,
        "district": "PARQUE BOA VISTA",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37030120",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS NAYME LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 236.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS NAYME LTDA",
        "tradeName": "ARMAZENS GERAIS NAYME",
        "cnpj": "01984305000148",
        "stateRegistration": "5357107540077",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ROQUE PORCARO",
        "addressNumber": "14",
        "addressComplement": null,
        "district": "ROQUE",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS PONTAL DO CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 23.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS PONTAL DO CAFE LTDA",
        "tradeName": "ARMAZENS GERAIS PONTAL DO CAFE LTDA",
        "cnpj": "17877510000144",
        "stateRegistration": "0021266580026",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MANOEL ZEFERINO",
        "addressNumber": "277",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CONCEICAO DA APARECIDA",
        "state": "MG",
        "postalCode": "37148000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS RAIZ FORTE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 33.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS RAIZ FORTE LTDA",
        "tradeName": "ARMAZENS GERAIS RAIZ FORTE",
        "cnpj": "45965800000185",
        "stateRegistration": "0043146630028",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUCIANA RIBEIRO PINHEIRO",
        "addressNumber": "244",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902281",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS SAO JOAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 451.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS SAO JOAO LTDA",
        "tradeName": "ARMAZENS GERAIS SAO JOAO LTDA",
        "cnpj": "22394696000382",
        "stateRegistration": "4095496930234",
        "municipalRegistration": null,
        "email": "fiscall@gardingotrade.com.br",
        "phone": null,
        "addressLine": "FAZENDA SANTA MARIA",
        "addressNumber": "01",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "MATIPO",
        "state": "MG",
        "postalCode": "35367000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS STOCKL LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 3.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS STOCKL LTDA",
        "tradeName": "ARMAZENS STOCKL",
        "cnpj": "01998256000100",
        "stateRegistration": "081897030",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA FRANCISCO STOCKL , KM 7,5",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SANTA MARIA",
        "city": "MARECHAL FLORIANO",
        "state": "ES",
        "postalCode": "29259000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS SUL CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 416.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS SUL CAFE LTDA",
        "tradeName": "ARMAZENS GERAIS SUL CAFE LTDA",
        "cnpj": "13092354000155",
        "stateRegistration": "0017172160053",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PIO XII",
        "addressNumber": "720",
        "addressComplement": null,
        "district": "CAPITAO GOMES",
        "city": "CAMPOS GERAIS",
        "state": "MG",
        "postalCode": "37160000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARMAZENS GERAIS TRES CORACOES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 79.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARMAZENS GERAIS TRES CORACOES LTDA",
        "tradeName": "ARMAZENS GERAIS TRES CORACOES LTDA",
        "cnpj": "71422075000109",
        "stateRegistration": "6938733370025",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA FERNAO DIAS",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "TRES CORACOES",
        "state": "MG",
        "postalCode": "37410001",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARNON SILVA LOBO",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 68.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARNON SILVA LOBO",
        "tradeName": "CAFE MELHOR DA BAHIA",
        "cnpj": "51560130000110",
        "stateRegistration": "209124291",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA MANOEL HEGIDIO",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "CATUABA - DIST.",
        "city": "BONITO",
        "state": "BA",
        "postalCode": "46820000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ARRIEL TRANSPORTE & CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 379.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ARRIEL TRANSPORTE & CAFE LTDA",
        "tradeName": "ARRIEL TRANSPORTE & CAFE LTDA",
        "cnpj": "62164197000151",
        "stateRegistration": "0052799880053",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA GETULIO VARGAS",
        "addressNumber": "325",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CAMPO BELO",
        "state": "MG",
        "postalCode": "37270000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ATLAS COMERCIO E INDUSTRIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 176.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ATLAS COMERCIO E INDUSTRIA LTDA",
        "tradeName": "CAFE BAMBINO",
        "cnpj": "01377514000123",
        "stateRegistration": "100108598",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA INDUSTRIAL",
        "addressNumber": "266",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CERES",
        "state": "GO",
        "postalCode": "76300000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BELGO INDUSTRIA, COMERCIO E DISTRIBUICAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 418.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BELGO INDUSTRIA, COMERCIO E DISTRIBUICAO LTDA",
        "tradeName": "BELGO INDUSTRIA, COMERCIO E DISTRIBUICAO LTDA",
        "cnpj": "19455202000237",
        "stateRegistration": "0022829420187",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR-265",
        "addressNumber": "3120",
        "addressComplement": null,
        "district": "VARZEA DO FARIA (BONFIM)",
        "city": "SAO JOAO DEL REI",
        "state": "MG",
        "postalCode": "36307700",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BERG COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 19.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BERG COMERCIO DE CAFE LTDA",
        "tradeName": "BERG CAFE",
        "cnpj": "28707866000156",
        "stateRegistration": "083356363",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV JOAO PEDRO BORTOTI",
        "addressNumber": "599",
        "addressComplement": null,
        "district": "NOVA COLATINA",
        "city": "ARACRUZ",
        "state": "ES",
        "postalCode": "29196512",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BICO DE OURO COMERCIO E INDUSTRIA DE GENEROS ALIMENTICIOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 83.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BICO DE OURO COMERCIO E INDUSTRIA DE GENEROS ALIMENTICIOS LTDA",
        "tradeName": "CAFE BICO DE OURO",
        "cnpj": "08060903000170",
        "stateRegistration": "0747689600144",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SETOR SES QUADRA 1 LOTE",
        "addressNumber": "15",
        "addressComplement": null,
        "district": "SETOR ECONOMICO DE SOBRADINHO",
        "city": "BRASILIA",
        "state": "DF",
        "postalCode": "73020401",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BOA SAFRA COMERCIO DE GRAOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 80.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BOA SAFRA COMERCIO DE GRAOS LTDA",
        "tradeName": "BOA SAFRA COMERCIO DE GRAOS LTDA",
        "cnpj": "17154590000100",
        "stateRegistration": "0020573270074",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R 13",
        "addressNumber": "462",
        "addressComplement": null,
        "district": "ROSA MISTICA",
        "city": "SANTA CRUZ DE MINAS",
        "state": "MG",
        "postalCode": "36328000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BOM DO GRAOS EXPORTACAO E COMERCIALIZACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 455.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BOM DO GRAOS EXPORTACAO E COMERCIALIZACAO LTDA",
        "tradeName": "BOM DO GRAOS EXPORTACAO E COME",
        "cnpj": "63944602000117",
        "stateRegistration": "444020775112",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ERNESTO CAVALIN",
        "addressNumber": "1326",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "MERIDIANO",
        "state": "SP",
        "postalCode": "15625007",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BOM PASTOR COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 359.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BOM PASTOR COMERCIO DE CAFE LTDA",
        "tradeName": "BOM PASTOR COMERCIO DE CAFE LTDA",
        "cnpj": "11023446000158",
        "stateRegistration": "0013253320049",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV MELO VIANA",
        "addressNumber": "109",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902290",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BOURBON SPECIALTY COFFEES S/A",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 259.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BOURBON SPECIALTY COFFEES S/A",
        "tradeName": "BOURBON",
        "cnpj": "03586538000703",
        "stateRegistration": "5180603730293",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA PRESIDENTE WENCESLAU BRAZ",
        "addressNumber": "2600",
        "addressComplement": null,
        "district": "PARQUE PRIMAVERA",
        "city": "POCOS DE CALDAS",
        "state": "MG",
        "postalCode": "37706000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BR CAFE COMERCIO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 303.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BR CAFE COMERCIO E EXPORTACAO LTDA",
        "tradeName": "BR CAFE",
        "cnpj": "46450165000166",
        "stateRegistration": "0043452130096",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ALAMEDA DO CAFE",
        "addressNumber": "195",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026400",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BRANDAO E ARAUJO TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 28.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BRANDAO E ARAUJO TRANSPORTES LTDA",
        "tradeName": "TRANSCAFE LOG",
        "cnpj": "17979681000184",
        "stateRegistration": "0021360470069",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA AURINO CIRILO DA COSTA",
        "addressNumber": "22",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902266",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BRASCAFE ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 242.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BRASCAFE ARMAZENS GERAIS LTDA",
        "tradeName": "BRASCAFE ARMAZENS GERAIS LTDA",
        "cnpj": "20578993000190",
        "stateRegistration": "0352013260053",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PRESIDENTE JUSCELINO KUBISTSCHEK",
        "addressNumber": "950",
        "addressComplement": null,
        "district": "MILENIUM",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38447376",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BRASCAFE BARBIERI ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 467.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BRASCAFE BARBIERI ARMAZENS GERAIS LTDA",
        "tradeName": "BRASCAFE BARBIERI ARMAZENS GER",
        "cnpj": "45637027000128",
        "stateRegistration": "0042923310020",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA RAUL JOSE DE BELEM",
        "addressNumber": "3001",
        "addressComplement": null,
        "district": "BOSQUE",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38446070",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BRASCAFE COMERCIO EXPORTACAO E IMPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 291.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BRASCAFE COMERCIO EXPORTACAO E IMPORTACAO DE CAFE LTDA",
        "tradeName": "BRASCAFE COMERCIO EXPORTACAO E IMPORTACAO DE CAFE LTDA",
        "cnpj": "45762106000322",
        "stateRegistration": "530116181113",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA WGASHINGTON LUIZ",
        "addressNumber": "630",
        "addressComplement": null,
        "district": "JARDIM DAS ROSAS",
        "city": "ESPIRITO SANTO DO PINHAL",
        "state": "SP",
        "postalCode": "13990000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BRASIL ESPRESSO COMERCIO ATACADISTA LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 338.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BRASIL ESPRESSO COMERCIO ATACADISTA LTDA.",
        "tradeName": "BRASIL ESPRESSO COMERCIO ATACADISTA LTDA.",
        "cnpj": "01703285000602",
        "stateRegistration": "407556513118",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DIACONO JOSIAS DE SOUZA",
        "addressNumber": "474",
        "addressComplement": null,
        "district": "JARDIM ERMIDA II",
        "city": "JUNDIAI",
        "state": "SP",
        "postalCode": "13212171",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BRAVUS COFFEE COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 478.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BRAVUS COFFEE COMERCIO LTDA",
        "tradeName": "BRAVUS COFFEE COMERCIO LTDA",
        "cnpj": "67645189000140",
        "stateRegistration": "0055685910070",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R DOUTOR OSWALDO MASCARENHAS LOTE 25",
        "addressNumber": "0",
        "addressComplement": null,
        "district": "MONTE CASTELO",
        "city": "JUIZ DE FORA",
        "state": "MG",
        "postalCode": "36081120",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BSC SERVICOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 178.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BSC SERVICOS LTDA",
        "tradeName": "BSC SERVICOS",
        "cnpj": "41084969000175",
        "stateRegistration": "0045294390086",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA THEOCRITO PINHEIRO",
        "addressNumber": "135",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902287",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "BUENO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 115.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "BUENO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA",
        "tradeName": "GOMES E BUENO",
        "cnpj": "31098578000156",
        "stateRegistration": "0032453920030",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AREA SITIO GOMES & BUENO",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "AREA RURAL DE PASSOS",
        "city": "PASSOS",
        "state": "MG",
        "postalCode": "37904899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE AQUI COMERCIO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 353.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE AQUI COMERCIO E EXPORTACAO LTDA",
        "tradeName": "CAFEAQUI.COM.BR",
        "cnpj": "54591058000186",
        "stateRegistration": "0048609130096",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DONA CESARIA",
        "addressNumber": "390",
        "addressComplement": null,
        "district": "GOIAS",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38442068",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE AROMA TROPICAL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 351.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE AROMA TROPICAL LTDA",
        "tradeName": "CAFE AROMA TROPICAL LTDA",
        "cnpj": "59549897000150",
        "stateRegistration": "202429083",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA 17",
        "addressNumber": "379",
        "addressComplement": null,
        "district": "BRO AEROVIARIO",
        "city": "GOIANIA",
        "state": "GO",
        "postalCode": "74435250",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE CAICARA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 54.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE CAICARA LTDA",
        "tradeName": "CAFE CAICARA LTDA",
        "cnpj": "50929884000131",
        "stateRegistration": "407014696118",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CICA",
        "addressNumber": "452",
        "addressComplement": null,
        "district": "VILA ANGELICA",
        "city": "JUNDIAI",
        "state": "SP",
        "postalCode": "13206765",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE CANECAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 327.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE CANECAO LTDA",
        "tradeName": "CAFE CANECAO LTDA",
        "cnpj": "45986700000135",
        "stateRegistration": "244007962112",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOAO FELIPE XAVIER DA SILVA",
        "addressNumber": "299",
        "addressComplement": null,
        "district": "SAO BERNARDO",
        "city": "CAMPINAS",
        "state": "SP",
        "postalCode": "13030680",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE CHAPADA DIAMANTINA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 422.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE CHAPADA DIAMANTINA LTDA",
        "tradeName": "CAFE CHAPADA DIAMANTINA",
        "cnpj": "58439087000188",
        "stateRegistration": "0053179600080",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA FRANCISCO GONCALVES VALIM",
        "addressNumber": "1070",
        "addressComplement": null,
        "district": "REZENDE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37062200",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE DO SITIO INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 55.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE DO SITIO INDUSTRIA E COMERCIO LTDA",
        "tradeName": "CAFE DO SITIO",
        "cnpj": "00452102000148",
        "stateRegistration": "0731549400170",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "QS 09 RUA 100 LOTE",
        "addressNumber": "04",
        "addressComplement": null,
        "district": "AGUAS CLARAS",
        "city": "BRASILIA",
        "state": "DF",
        "postalCode": "71976370",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE DONA MARIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 406.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE DONA MARIA LTDA",
        "tradeName": "CAFE DONA MARIA",
        "cnpj": "50287126000167",
        "stateRegistration": "200285831",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOAQUIM DA SILVA RIBEIRO",
        "addressNumber": "700",
        "addressComplement": null,
        "district": "SETOR CENTRAL",
        "city": "OUVIDOR",
        "state": "GO",
        "postalCode": "75715000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE EXPORT INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 337.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE EXPORT INDUSTRIA E COMERCIO LTDA",
        "tradeName": "CAFE EXPORT",
        "cnpj": "00680868000180",
        "stateRegistration": "0734573400163",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "QUADRA AC 105 CONJUNTO C",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SANTA MARIA",
        "city": "BRASILIA",
        "state": "DF",
        "postalCode": "72505103",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE FAFA INDUSTRIA E COMERCIO DE ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 425.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE FAFA INDUSTRIA E COMERCIO DE ALIMENTOS LTDA",
        "tradeName": "CAFE FAFA",
        "cnpj": "13614656000146",
        "stateRegistration": "024826242",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 242",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "BELA VISTA",
        "city": "BARREIRAS",
        "state": "BA",
        "postalCode": "47804510",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE FAZENDA OURO VERDE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 277.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE FAZENDA OURO VERDE LTDA",
        "tradeName": "CAFE FAZENDA OURO VERDE",
        "cnpj": "34189467000143",
        "stateRegistration": "0034909170090",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA NOSSA SENHORA APARECIDA",
        "addressNumber": "460",
        "addressComplement": null,
        "district": "PRIMAVERA",
        "city": "CAMPOS GERAIS",
        "state": "MG",
        "postalCode": "37160000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE FORTE GRAO ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 53.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE FORTE GRAO ARMAZENS GERAIS LTDA",
        "tradeName": "CAFE FORTE GRAO",
        "cnpj": "46192156000112",
        "stateRegistration": "0043287890093",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DR. LICURGO LEITE",
        "addressNumber": "99",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "MUZAMBINHO",
        "state": "MG",
        "postalCode": "37890000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE IGUAPORA - TORREFACAO E MOAGEM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 473.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE IGUAPORA - TORREFACAO E MOAGEM LTDA",
        "tradeName": "CAFE IGUAPORA",
        "cnpj": "02032985000162",
        "stateRegistration": "282429808",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA RUI BARBOSA",
        "addressNumber": "1255",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SETE QUEDAS",
        "state": "MS",
        "postalCode": "79935000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE LEM COMERCIO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 116.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE LEM COMERCIO E EXPORTACAO LTDA",
        "tradeName": "CAFE LEM COMERCIO E EXPORTACAO LTDA",
        "cnpj": "34710696000161",
        "stateRegistration": "0035312700045",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DO COMERCIO DE CAFE",
        "addressNumber": "121",
        "addressComplement": null,
        "district": "INDUSTRIAL REINALDO FORESTI",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026530",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE MINAS EXPORT LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 420.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE MINAS EXPORT LTDA",
        "tradeName": "CAFE MINAS EXPORT",
        "cnpj": "57399213000155",
        "stateRegistration": "0050002970074",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MINAS GERAIS",
        "addressNumber": "55",
        "addressComplement": null,
        "district": "CONJUNTO MINAS GERAIS",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026550",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE OURO RICO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 388.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE OURO RICO LTDA",
        "tradeName": "CAFE OURO RICO",
        "cnpj": "08111646000158",
        "stateRegistration": "104074760",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ALVORADA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "PARQUE INDUSTRIAL",
        "city": "RIALMA",
        "state": "GO",
        "postalCode": "76310000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE PARANOA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 342.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE PARANOA LTDA",
        "tradeName": "CAFE PARANOA",
        "cnpj": "55100189000186",
        "stateRegistration": "0830018500199",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SETOR SEES QUADRA 1 LOTE",
        "addressNumber": "15",
        "addressComplement": null,
        "district": "SOBRADINHO",
        "city": "BRASILIA",
        "state": "DF",
        "postalCode": "73020401",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE PARREIRA TORREFACAO E MOAGEM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 474.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE PARREIRA TORREFACAO E MOAGEM LTDA",
        "tradeName": "CAFE PARREIRA",
        "cnpj": "29828891000150",
        "stateRegistration": "284329142",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 163, RUA 03",
        "addressNumber": "90",
        "addressComplement": null,
        "district": "PARQUE INDUSTRIAL LONDRINA",
        "city": "DOURADOS",
        "state": "MS",
        "postalCode": "79804970",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE QUETAL INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 423.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE QUETAL INDUSTRIA E COMERCIO LTDA",
        "tradeName": "CAFE QUETAL INDUSTRIA E COMERCIO LTDA",
        "cnpj": "86432879000247",
        "stateRegistration": "0010883290154",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MARIA DE SIMONE PROSPERI",
        "addressNumber": "65",
        "addressComplement": null,
        "district": "CHACARAS BOM JARDIM",
        "city": "GUAXUPE",
        "state": "MG",
        "postalCode": "37800000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE REDE GRAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 279.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE REDE GRAO LTDA",
        "tradeName": "CAFE REDE GRAO",
        "cnpj": "50653995000168",
        "stateRegistration": "0046154550090",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 365",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "TOCANTINS",
        "city": "UBERLANDIA",
        "state": "MG",
        "postalCode": "38415272",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE REMANESCENTE COMERCIO, IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 190.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE REMANESCENTE COMERCIO, IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "CAFE REMANESCENTE COMERCIO, IMPORTACAO E EXPORTACAO LTDA",
        "cnpj": "06104157000143",
        "stateRegistration": "0035018250011",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ALAMEDA DO CAFE",
        "addressNumber": "292",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026400",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE REX ARMAZENAGEM INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 387.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE REX ARMAZENAGEM INDUSTRIA E COMERCIO LTDA",
        "tradeName": "CAFE REX",
        "cnpj": "36448042000137",
        "stateRegistration": "0036766170018",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA BELO HORIZONTE",
        "addressNumber": "254",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "BOM JESUS DA PENHA",
        "state": "MG",
        "postalCode": "37948000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE RIQUEZA DE MINAS COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 85.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE RIQUEZA DE MINAS COMERCIO DE CAFE LTDA",
        "tradeName": "CAFE RIQUEZA DE MINAS",
        "cnpj": "39797781000122",
        "stateRegistration": "0038966830072",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ESTRADA DOS TACHOS",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37002970",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE SACRAMENTO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 113.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE SACRAMENTO LTDA",
        "tradeName": "CAFE SACRAMENTO",
        "cnpj": "29814139000150",
        "stateRegistration": "0031409720080",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MONJOLIN",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SACRAMENTO",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36900000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE SAO JOAQUIM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 89.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE SAO JOAQUIM LTDA",
        "tradeName": "CAFES CRUZ BOURBON SAO JOAQUIM",
        "cnpj": "45990066000104",
        "stateRegistration": "244026257116",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SETE DE SETEMBRO",
        "addressNumber": "270",
        "addressComplement": null,
        "district": "VILA INDUSTRIAL",
        "city": "CAMPINAS",
        "state": "SP",
        "postalCode": "13035350",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE SOUZA LIMA INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 282.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE SOUZA LIMA INDUSTRIA E COMERCIO LTDA",
        "tradeName": "CAFE SOUZA LIMA INDUSTRIA E COMERCIO LTDA",
        "cnpj": "05095130000179",
        "stateRegistration": "2612007270009",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA BENEDITO LUIS DE FARIA - DICO",
        "addressNumber": "250",
        "addressComplement": null,
        "district": "CENTRO INDUSTRIAL II",
        "city": "FORMIGA",
        "state": "MG",
        "postalCode": "35570000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE TRES MARCOS INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 101.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE TRES MARCOS INDUSTRIA E COMERCIO LTDA",
        "tradeName": "CAFE TRES MARCOS INDUSTRIA E COMERCIO LTDA",
        "cnpj": "20627691000165",
        "stateRegistration": "7024494490092",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA IGNEZ FAVATO",
        "addressNumber": "180",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "UBERLANDIA",
        "state": "MG",
        "postalCode": "38402340",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE UTAM S A",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 417.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE UTAM S A",
        "tradeName": "CAFE UTAM S A",
        "cnpj": "56012420000304",
        "stateRegistration": "5157018010017",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA PRESIDENTE JUSCELINO",
        "addressNumber": "456",
        "addressComplement": null,
        "district": "SAO FRANCISCO",
        "city": "PIUMHI",
        "state": "MG",
        "postalCode": "37925000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFE VIOLA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 368.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFE VIOLA LTDA",
        "tradeName": "CAFE VIOLA",
        "cnpj": "00994062000166",
        "stateRegistration": "00131661515",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA 10",
        "addressNumber": "0",
        "addressComplement": null,
        "district": "BR 070",
        "city": "BARRA DO GARCAS",
        "state": "MT",
        "postalCode": "78600000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEBRAS COMERCIO DE CAFES DO BRASIL S.A. - EM RECUPERACAO J",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 462.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEBRAS COMERCIO DE CAFES DO BRASIL S.A. - EM RECUPERACAO J",
        "tradeName": "CAFEBRAS COMERCIO DE CAFES DO",
        "cnpj": "17611589000167",
        "stateRegistration": "0021019980010",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA GENERAL ASTOLFO FERREIRA MENDES",
        "addressNumber": "650",
        "addressComplement": null,
        "district": "MORADA DO SOL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38744604",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA ALBERTINA SUL DE MINAS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 82.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA ALBERTINA SUL DE MINAS LTDA",
        "tradeName": "CAFEEIRA ALBERTINA SUL DE MINA",
        "cnpj": "58342603000151",
        "stateRegistration": "0050556300033",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUIZ FERRARI",
        "addressNumber": "559",
        "addressComplement": null,
        "district": "SANTA CLARA",
        "city": "ALBERTINA",
        "state": "MG",
        "postalCode": "37596000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA CORREIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 50.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA CORREIA LTDA",
        "tradeName": "CAFEEIRA CORREIA LTDA",
        "cnpj": "33638977000198",
        "stateRegistration": "0034466470073",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CEL.JOAQUIM SILVERIO",
        "addressNumber": "170",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SAO PEDRO DA UNIAO",
        "state": "MG",
        "postalCode": "37855000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA GAZONI COMERCIO DE GRAOS LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 17.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA GAZONI COMERCIO DE GRAOS LTDA",
        "tradeName": "CAFEEIRA GAZONI",
        "cnpj": "41973985000119",
        "stateRegistration": "083768629",
        "municipalRegistration": null,
        "email": "cafeeiragazoni@gmail.com",
        "phone": null,
        "addressLine": "RUA MARIA JOSEFINA DE RESENDE",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "CAFE MOCA",
        "city": "MIMOSO DO SUL",
        "state": "ES",
        "postalCode": "29400000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA GRAO FORTE COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 78.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA GRAO FORTE COMERCIO DE CAFE LTDA",
        "tradeName": "GRAO FORTE CORRETORA",
        "cnpj": "40468356000179",
        "stateRegistration": "0039456960005",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV FREI GASPAR",
        "addressNumber": "1035",
        "addressComplement": null,
        "district": "VILA NOVA",
        "city": "MANTENA",
        "state": "MG",
        "postalCode": "35290000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA GRAOS DE MINAS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 269.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA GRAOS DE MINAS LTDA",
        "tradeName": "CAFEEIRA GRAOS DE MINAS LTDA",
        "cnpj": "62745895000140",
        "stateRegistration": "0053061190040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R AVELINO DE ANDRADE PINHEIRO",
        "addressNumber": "310",
        "addressComplement": null,
        "district": "VILA JARDIM NOSSA SENHORA DE FATIMA",
        "city": "SAO JOAO DEL REI",
        "state": "MG",
        "postalCode": "36305340",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA GUAXUPE COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 158.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA GUAXUPE COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "CAFEEIRA GUAXUPE",
        "cnpj": "26233590000196",
        "stateRegistration": "0028363090034",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA HORACIO FERREIRA LOPES",
        "addressNumber": "50",
        "addressComplement": null,
        "district": "ANGOLA",
        "city": "GUAXUPE",
        "state": "MG",
        "postalCode": "37834038",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA OLIVEIRENSE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 169.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA OLIVEIRENSE LTDA",
        "tradeName": "CAFEEIRA OLIVEIRENSE LTDA",
        "cnpj": "22355747000103",
        "stateRegistration": "4565363600005",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA GOITACAZES",
        "addressNumber": "507",
        "addressComplement": null,
        "district": "DONA ZICA",
        "city": "OLIVEIRA",
        "state": "MG",
        "postalCode": "35540000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA PARANA COM. EXPOR. IMPOR. DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 29.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA PARANA COM. EXPOR. IMPOR. DE CAFE LTDA",
        "tradeName": "CAFEEIRA PARANA COM. EXPOR. IM",
        "cnpj": "19046467000281",
        "stateRegistration": "0033108460080",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DR SILVESTRE MOREIRA",
        "addressNumber": "2918",
        "addressComplement": null,
        "district": "SAO BENEDITO",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38743082",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA PRATA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 7.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA PRATA LTDA",
        "tradeName": "CAFEEIRA PRATA LTDA",
        "cnpj": "11014630000131",
        "stateRegistration": "0013198730058",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FAZENDA SEM PEIXE",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SAO MIGUEL DO ANTA",
        "state": "MG",
        "postalCode": "36590000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA PRIMICIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 183.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA PRIMICIA LTDA",
        "tradeName": "CAFEEIRA PRIMICIA LTDA",
        "cnpj": "64449606000191",
        "stateRegistration": "8337095090079",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUCIANA RIBEIRO PINHEIRO",
        "addressNumber": "01",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902281",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA PRIMICIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 371.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA PRIMICIA LTDA",
        "tradeName": "CAFEEIRA PRIMICIA LTDA",
        "cnpj": "64449606000272",
        "stateRegistration": "8337095090150",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R LUCIANA RIBEIRO PINHEIRO",
        "addressNumber": "01",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902281",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA REAL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 161.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA REAL LTDA",
        "tradeName": "CAFEEIRA REAL",
        "cnpj": "13657923000162",
        "stateRegistration": "0023062930004",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA MOACIR DE MATOS",
        "addressNumber": "531",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CARATINGA",
        "state": "MG",
        "postalCode": "35300399",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA SAO MATHEUS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 485.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA SAO MATHEUS LTDA",
        "tradeName": "CAFEEIRA SAO MATEUS",
        "cnpj": "14677398000100",
        "stateRegistration": "0018784370025",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JURANA",
        "addressNumber": "221",
        "addressComplement": null,
        "district": "RESIDENCIAL TEIXEIRA",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37132360",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA SAO VICENTE LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 294.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA SAO VICENTE LTDA.",
        "tradeName": "CAFEEIRA SAO VICENTE",
        "cnpj": "22607530000135",
        "stateRegistration": "0025710860069",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA AVENIDA ALICE GOMES ARAUJO",
        "addressNumber": "240",
        "addressComplement": null,
        "district": "GOMES ARAUJO",
        "city": "SERICITA",
        "state": "MG",
        "postalCode": "35368000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEEIRA ZE DO FLOR EXPORTACAO DE CAFE S.A",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 434.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEEIRA ZE DO FLOR EXPORTACAO DE CAFE S.A",
        "tradeName": "CAFEEIRA ZE DO FLOR EXPORTACAO",
        "cnpj": "10471130000166",
        "stateRegistration": "0019042720018",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO DO BELEM",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SAO DOMINGOS DAS DORES",
        "state": "MG",
        "postalCode": "35335000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEINA COM CORRETORA E EXP DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 449.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEINA COM CORRETORA E EXP DE CAFE LTDA",
        "tradeName": "CAFEINA COM CORRETORA E EXP DE CAFE LTDA",
        "cnpj": "11294343000122",
        "stateRegistration": "0014868980092",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ALAMEDA DO CAFE",
        "addressNumber": "115",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026400",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFESP ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 309.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFESP ARMAZENS GERAIS LTDA",
        "tradeName": "AGB (ALL GOODS BRASIL)",
        "cnpj": "38240124000117",
        "stateRegistration": "0038226640067",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR-050",
        "addressNumber": "1501",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38446232",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFESP INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 396.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFESP INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "CAFE PINHALZINHO",
        "cnpj": "01777661000190",
        "stateRegistration": "531005791118",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DA SAUDADE",
        "addressNumber": "381",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "PINHALZINHO",
        "state": "SP",
        "postalCode": "12995000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFEZINHO TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 349.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFEZINHO TRANSPORTES LTDA",
        "tradeName": "CAFEZINHO TRANSPORTES",
        "cnpj": "33395760000102",
        "stateRegistration": "083559299",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DOUTOR VALERIO",
        "addressNumber": "267",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "VILA VALERIO",
        "state": "ES",
        "postalCode": "29785000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFFER ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 69.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFFER ARMAZENS GERAIS LTDA",
        "tradeName": "CAFFER",
        "cnpj": "11656335000189",
        "stateRegistration": "0015621340060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA RITA BORGES LIBORIO",
        "addressNumber": "111",
        "addressComplement": null,
        "district": "JARDIM VITORIA II",
        "city": "SAO SEBASTIAO DO PARAISO",
        "state": "MG",
        "postalCode": "37950000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAFIMA COMERCIO IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 475.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAFIMA COMERCIO IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "CAFIMA COMERCIO IMPORTACAO E EXPORTACAO LTDA",
        "cnpj": "21760210000158",
        "stateRegistration": "3903016840052",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ARTUR BERNARDES",
        "addressNumber": "907",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "MACHADO",
        "state": "MG",
        "postalCode": "37750000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CALDAS ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 343.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CALDAS ALIMENTOS LTDA",
        "tradeName": "CAFE CALDAS",
        "cnpj": "02370310000123",
        "stateRegistration": "100297331",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "VIA PRIMARIA",
        "addressNumber": "400",
        "addressComplement": null,
        "district": "DISTRITO AGROINDUSTRIAL DE CALDAS NOVAS",
        "city": "CALDAS NOVAS",
        "state": "GO",
        "postalCode": "75682800",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAMIL ALIMENTOS S.A.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 270.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAMIL ALIMENTOS S.A.",
        "tradeName": "CAMIL ALIMENTOS S.A.",
        "cnpj": "64904295006063",
        "stateRegistration": "7042464221326",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JOSE RIBEIRO TRISTAO",
        "addressNumber": "120",
        "addressComplement": null,
        "district": "AEROPORTO",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37031075",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAMIL ALIMENTOS S.A.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 271.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAMIL ALIMENTOS S.A.",
        "tradeName": "CAMIL ALIMENTOS S.A.",
        "cnpj": "64904295005768",
        "stateRegistration": "7042464221164",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR-491 VARGINHA-TRES CORACOES",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "REZENDE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37062195",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAMPO VERDE ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 181.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAMPO VERDE ARMAZENS GERAIS LTDA",
        "tradeName": "CAMPO VERDE",
        "cnpj": "06326061000200",
        "stateRegistration": "0010667050043",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA GERALDO MARTINS COSTA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "BORTOLAN SUL",
        "city": "POCOS DE CALDAS",
        "state": "MG",
        "postalCode": "37718000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAMPOS ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 194.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAMPOS ARMAZENS GERAIS LTDA",
        "tradeName": "CAMPOS ARMAZENS GERAIS",
        "cnpj": "30690869000176",
        "stateRegistration": "0032113920034",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CORONEL JOAO CANDIDO DE AGUIAR",
        "addressNumber": "2156",
        "addressComplement": null,
        "district": "INDUSTRIAL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38740518",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CAMPOS COMERCIO ATACADISTA DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 193.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CAMPOS COMERCIO ATACADISTA DE CAFE LTDA",
        "tradeName": "CAMPOS CAFE",
        "cnpj": "15393429000163",
        "stateRegistration": "0027194800047",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CORONEL JOAO CANDIDO DE AGUIAR",
        "addressNumber": "2156",
        "addressComplement": null,
        "district": "INDUSTRIAL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38740518",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CASA DO CAFE ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 414.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CASA DO CAFE ARMAZENS GERAIS LTDA",
        "tradeName": "CASA DO CAFE",
        "cnpj": "07932553000121",
        "stateRegistration": "0010035130083",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PONTAL",
        "addressNumber": "40",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ELOI MENDES",
        "state": "MG",
        "postalCode": "37110000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CASTRO ALVES DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 246.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CASTRO ALVES DE CAFE LTDA",
        "tradeName": "COMCAFE",
        "cnpj": "71003636000135",
        "stateRegistration": "0358308150068",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA VEREADOR GERALDO TEODORO",
        "addressNumber": "525",
        "addressComplement": null,
        "district": "BOSQUE",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38446124",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CATUAI DO BRASIL INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 26.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CATUAI DO BRASIL INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "CATUAY DO BRASIL",
        "cnpj": "51095578000100",
        "stateRegistration": "177002435110",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA AGUAPEI",
        "addressNumber": "4200",
        "addressComplement": null,
        "district": "JARDIM CALIFORNIA",
        "city": "ARACATUBA",
        "state": "SP",
        "postalCode": "16058703",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CEREJA COMERCIO ATACADISTA DE CAFE LTDA.,",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 385.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CEREJA COMERCIO ATACADISTA DE CAFE LTDA.,",
        "tradeName": "CEREJA COMERCIO ATACADISTA DE CAFE LTDA.,",
        "cnpj": "03288291000153",
        "stateRegistration": "0260328000058",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA RICARTI TEIXEIRA",
        "addressNumber": "304",
        "addressComplement": null,
        "district": "JARDIM AMERICA",
        "city": "ANDRADAS",
        "state": "MG",
        "postalCode": "37795000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CITA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 47.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CITA LTDA",
        "tradeName": "CAFE MESMO",
        "cnpj": "22274385000118",
        "stateRegistration": "6965018140078",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE GOMES MOREIRA",
        "addressNumber": "241",
        "addressComplement": null,
        "district": "TIRADENTES",
        "city": "TUPACIGUARA",
        "state": "MG",
        "postalCode": "38480000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CLAUDIO ROBERTO MARTINS COIMBRA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 91.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CLAUDIO ROBERTO MARTINS COIMBRA",
        "tradeName": "CAFE MINEIRINHO",
        "cnpj": "23203301000118",
        "stateRegistration": "0026212800057",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DA PAZ",
        "addressNumber": "890",
        "addressComplement": null,
        "district": "PORTAL DO SOL",
        "city": "ELOI MENDES",
        "state": "MG",
        "postalCode": "37110000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COFFEA IMPORTACAO, EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 234.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COFFEA IMPORTACAO, EXPORTACAO DE CAFE LTDA",
        "tradeName": "COFFEA",
        "cnpj": "19340666000389",
        "stateRegistration": "0037449540061",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ENGENHEIRO WASHINGTON MARTONI",
        "addressNumber": "570",
        "addressComplement": null,
        "district": "PARQUE INDUSTRIAL MARIA INES P",
        "city": "SAO SEBASTIAO DO PARAISO",
        "state": "MG",
        "postalCode": "37950000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COFFEE GRAINS COMERCIO DE GRAOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 446.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COFFEE GRAINS COMERCIO DE GRAOS LTDA",
        "tradeName": "COFFEE GRAINS",
        "cnpj": "11131814000181",
        "stateRegistration": "0013967640027",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV DR JULIO CESAR DADALTI BARROSO",
        "addressNumber": "923",
        "addressComplement": null,
        "district": "BELA VISTA",
        "city": "ERVALIA",
        "state": "MG",
        "postalCode": "36555000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COFFEE MINAS COMERCIO E ARMAZENAGEM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 380.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COFFEE MINAS COMERCIO E ARMAZENAGEM LTDA",
        "tradeName": "COFFEE MINAS",
        "cnpj": "14413437000161",
        "stateRegistration": "0018517210000",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 369",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "BOA ESPERANCA",
        "state": "MG",
        "postalCode": "37170000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COFFEEBE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 99.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COFFEEBE LTDA",
        "tradeName": "COFFEEBE LTDA",
        "cnpj": "49537421000145",
        "stateRegistration": "0048195850073",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV CELINA FERREIRA OTONI",
        "addressNumber": "4360",
        "addressComplement": null,
        "district": "PADRE VICTOR",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37048005",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIAL CENTENARIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 384.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIAL CENTENARIA LTDA",
        "tradeName": "CAFE SULTAO",
        "cnpj": "63114627000193",
        "stateRegistration": "203280881",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BRASÍLIA",
        "addressNumber": "106",
        "addressComplement": null,
        "district": "SÃO JOÃO",
        "city": "CATALAO",
        "state": "GO",
        "postalCode": "75703120",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIO ATACADISTA DE CAFE MUNDO NOVO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 30.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIO ATACADISTA DE CAFE MUNDO NOVO LTDA",
        "tradeName": "MUNDO NOVO COMERCIO DE CAFE",
        "cnpj": "03913560000125",
        "stateRegistration": "0032779090057",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUCIANA RIBEIRO PINHEIRO",
        "addressNumber": "242",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902281",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIO ATACADISTA E EXPORTACAO DE CAFE ESTRELA D'OESTE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 61.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIO ATACADISTA E EXPORTACAO DE CAFE ESTRELA D'OESTE LTDA",
        "tradeName": "ESTRELA D'OESTE",
        "cnpj": "34975715000181",
        "stateRegistration": "0035528320054",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA MG 341",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "PIUMHI",
        "state": "MG",
        "postalCode": "37925000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIO DE CAFE BARROS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 56.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIO DE CAFE BARROS LTDA",
        "tradeName": "COMERCIO DE CAFE BARROS LTDA",
        "cnpj": "21681315000111",
        "stateRegistration": "0024924470066",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ISAAC SIMAO",
        "addressNumber": "665",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CAMPESTRE",
        "state": "MG",
        "postalCode": "37730000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIO DE CAFE BUENO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 62.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIO DE CAFE BUENO LTDA",
        "tradeName": "COMERCIO DE CAFE BUENO LTDA",
        "cnpj": "08007943000158",
        "stateRegistration": "0010067040004",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MANOEL CUSTODIO",
        "addressNumber": "761",
        "addressComplement": null,
        "district": "LAVAPES",
        "city": "NOVA RESENDE",
        "state": "MG",
        "postalCode": "37860000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIO DE CAFE E ARMAZENS BOM JESUS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 164.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIO DE CAFE E ARMAZENS BOM JESUS LTDA",
        "tradeName": "COMERCIO DE CAFE E ARMAZENS BO",
        "cnpj": "24822917000130",
        "stateRegistration": "0027620730036",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ODILON NOGUEIRA",
        "addressNumber": "472",
        "addressComplement": null,
        "district": "NOSSA SRA APARECIDA",
        "city": "BOM JESUS DA PENHA",
        "state": "MG",
        "postalCode": "37948000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIO DE CAFE ESMERALDA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 284.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIO DE CAFE ESMERALDA LTDA",
        "tradeName": "ESMERALDA COMERCIO DE CAFE",
        "cnpj": "44474236000135",
        "stateRegistration": "42140890019",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA AMADO FRANCELINO DE JESUS",
        "addressNumber": "49",
        "addressComplement": null,
        "district": "CARMO DA CACHOEIRA",
        "city": "CARMO DA CACHOEIRA",
        "state": "MG",
        "postalCode": "37225000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMERCIO IMPORTACAO E EXPORTACAO DE CAFE COLONIAL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 481.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMERCIO IMPORTACAO E EXPORTACAO DE CAFE COLONIAL LTDA",
        "tradeName": "CAFE COLONIAL",
        "cnpj": "51179907000281",
        "stateRegistration": "0046619930026",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SRA. LUCINEIA APARECIDA BRESSANIN DE LIMA",
        "addressNumber": "077",
        "addressComplement": null,
        "district": "VILA SANTA RITA",
        "city": "ANDRADAS",
        "state": "MG",
        "postalCode": "37795000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMEXIM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 87.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMEXIM LTDA",
        "tradeName": "COMEXIM",
        "cnpj": "58150087001992",
        "stateRegistration": "4602239840410",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE CAMILO AVELAR",
        "addressNumber": "269",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902278",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COMPANHIA CAPITAL DE PRODUTOS ALIMENTICIOS",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 32. Documento exibido no relatorio: 33.175.092-08 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe em 23/07/2026. Codigo Vulpe: 355.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 32.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COMPANHIA CAPITAL DE PRODUTOS ALIMENTICIOS",
        "tradeName": "COMPANHIA CAPITAL DE PRODUTOS ALIMENTICIOS",
        "cnpj": "33175092000108",
        "stateRegistration": "81998590",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ITAOCA",
        "addressNumber": "1925",
        "addressComplement": null,
        "district": "INHAUMA",
        "city": "RIO DE JANEIRO",
        "state": "RJ",
        "postalCode": "21061771",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOP. DOS CAF. DO CERRADO DE MTE CARMELO",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 415.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOP. DOS CAF. DO CERRADO DE MTE CARMELO",
        "tradeName": "MONTECCER - MATRIZ",
        "cnpj": "00650386000187",
        "stateRegistration": "4317414310004",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ROD MG 190 KM 3,9",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "MONTE CARMELO",
        "state": "MG",
        "postalCode": "38500000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA AGRO PECUARIA DO VALE DO SAPUCAI LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 191.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA AGRO PECUARIA DO VALE DO SAPUCAI LTDA",
        "tradeName": "Coopervass",
        "cnpj": "24662298001054",
        "stateRegistration": "6200996340998",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA Avenida Tiradentes",
        "addressNumber": "362",
        "addressComplement": null,
        "district": "Inconfidentes",
        "city": "SAO GONCALO DO SAPUCAI",
        "state": "MG",
        "postalCode": "37490000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA AGROPECUARIA CENTRO SERRANA",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 33. Documento exibido no relatorio: 27.942.085-50 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 33.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA AGROPECUARIA CENTRO SERRANA",
        "tradeName": "COOPEAVI",
        "cnpj": "27942085000850",
        "stateRegistration": "081015593",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SAO SEBASTIAO",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "BAIXO SAO SEBASTIAO",
        "city": "SANTA MARIA DE JETIBA",
        "state": "ES",
        "postalCode": "29645000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA DOS CAFEICULTORES DA REGIAO DE LAJINHA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 290.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA DOS CAFEICULTORES DA REGIAO DE LAJINHA LTDA",
        "tradeName": "COOCAFE",
        "cnpj": "21025069000140",
        "stateRegistration": "3772558410040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO DO AREADO",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "AREADO",
        "city": "LAJINHA",
        "state": "MG",
        "postalCode": "36980000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA DOS CAFEICULTORES DO CERRADO DE ARAGUARI E REGIAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 241.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA DOS CAFEICULTORES DO CERRADO DE ARAGUARI E REGIAO LTDA",
        "tradeName": "COOCACER ARAGUARI",
        "cnpj": "71428874000192",
        "stateRegistration": "0358662950080",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA MG-29",
        "addressNumber": "605",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38446306",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA DOS CAFEICULTORES E AGROPECUARISTAS DO SUDOESTE MINEIRO LT",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 14.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA DOS CAFEICULTORES E AGROPECUARISTAS DO SUDOESTE MINEIRO LT",
        "tradeName": "COCASUL",
        "cnpj": "11211692000133",
        "stateRegistration": "0014475520002",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE FORTUNATO FILHO",
        "addressNumber": "267",
        "addressComplement": null,
        "district": "CAMPO VERDE",
        "city": "IBIRACI",
        "state": "MG",
        "postalCode": "37990000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA DOS CAMINHONEIROS DE ELOI MENDES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 212.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA DOS CAMINHONEIROS DE ELOI MENDES LTDA",
        "tradeName": "COOPERCEM",
        "cnpj": "34905808000130",
        "stateRegistration": "0035472640091",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CHACARA NOSSA SENHORA APARECIDA",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "DA ONCA",
        "city": "ELOI MENDES",
        "state": "MG",
        "postalCode": "37110000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA DOS TRANSPORTADORES AUTONOMOS E LOGISTICA DE VARGINHA - CO",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 369.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA DOS TRANSPORTADORES AUTONOMOS E LOGISTICA DE VARGINHA - CO",
        "tradeName": "COOTRALOV",
        "cnpj": "10660457000186",
        "stateRegistration": "0011107540089",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE MOREIRA LEITE",
        "addressNumber": "45",
        "addressComplement": null,
        "district": "PARQUE RESIDENCIAL RIO VERDE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37066050",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA DOS TRANSPORTADORES RODOVIARIOS AUTONOMOS DE BENS DE TRES",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 328.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA DOS TRANSPORTADORES RODOVIARIOS AUTONOMOS DE BENS DE TRES",
        "tradeName": "COTRANSP",
        "cnpj": "66423203000107",
        "stateRegistration": "6947830890070",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ARISTIDES B FIGUEIREDO",
        "addressNumber": "120",
        "addressComplement": null,
        "district": null,
        "city": "TRES PONTAS",
        "state": "MG",
        "postalCode": "37190000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA REGIONAL DE CAFEICULTORES EM GUAXUPE LTDA COOXUPE",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 346.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA REGIONAL DE CAFEICULTORES EM GUAXUPE LTDA COOXUPE",
        "tradeName": "COOPERATIVA REGIONAL DE CAFEICULTORES EM GUAXUPE LTDA COOXUPE",
        "cnpj": "20770566000533",
        "stateRegistration": "2870486360415",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MANOEL GONCALVES FERRAZ",
        "addressNumber": "356",
        "addressComplement": null,
        "district": "VILA SANTA BARBARA",
        "city": "GUAXUPE",
        "state": "MG",
        "postalCode": "37834070",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOPERATIVA REGIONAL INDUSTRIA E COMERCIO DE PRODU",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 410.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOPERATIVA REGIONAL INDUSTRIA E COMERCIO DE PRODU",
        "tradeName": "COOPERATIVA REGIONAL INDUSTRIA E COMERCIO DE PRODU",
        "cnpj": "08437629000105",
        "stateRegistration": "0010237300044",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PADRE FRANCISCO DE CARVALHO",
        "addressNumber": "138",
        "addressComplement": null,
        "district": "SAO SEBASTIAO DO SACRAMENTO",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36909700",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOTRAL- COOPERATIVA DOS TRANSPORTADORES RODOVIARIOS DE CARGAS DE ALFE",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 377.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOTRAL- COOPERATIVA DOS TRANSPORTADORES RODOVIARIOS DE CARGAS DE ALFE",
        "tradeName": "COOTRAL",
        "cnpj": "08295981000153",
        "stateRegistration": "0010254040047",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA TUPI",
        "addressNumber": "168",
        "addressComplement": null,
        "district": "VILA TEIXEIRA",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37132379",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COOTRAMA - COOPERATIVA DE TRANSPORTE DE MACHADO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 407.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COOTRAMA - COOPERATIVA DE TRANSPORTE DE MACHADO LTDA",
        "tradeName": "COOTRAMA",
        "cnpj": "23749796000185",
        "stateRegistration": "0026673470070",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DOUTOR RENATO AZEREDO",
        "addressNumber": "581",
        "addressComplement": null,
        "district": "OURO VERDE",
        "city": "MACHADO",
        "state": "MG",
        "postalCode": "37750000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COPA CAFE COMERCIO E EXPORTACAO LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 401.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COPA CAFE COMERCIO E EXPORTACAO LTDA.",
        "tradeName": "COPA TRADING",
        "cnpj": "27610206000432",
        "stateRegistration": "0029558310271",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA ANTONIO RUST",
        "addressNumber": "1058",
        "addressComplement": null,
        "district": "ROQUE",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COPA CAFE COMERCIO E EXPORTACAO LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 404.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COPA CAFE COMERCIO E EXPORTACAO LTDA.",
        "tradeName": "COPA CAFE COMERCIO E EXPORTACAO LTDA.",
        "cnpj": "27610206000270",
        "stateRegistration": "0029558310190",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA ANTONIO RUST",
        "addressNumber": "1058",
        "addressComplement": null,
        "district": "ROQUE",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COPA CAFE COMERCIO E EXPORTACAO LTDA..",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 403.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COPA CAFE COMERCIO E EXPORTACAO LTDA..",
        "tradeName": "COPA CAFE",
        "cnpj": "27610206000190",
        "stateRegistration": "0029558310018",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA ANTONIO RUST",
        "addressNumber": "1042",
        "addressComplement": null,
        "district": "ROQUE",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "COSTA CAFE COMERCIO EXPORTACAO E IMPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 339.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "COSTA CAFE COMERCIO EXPORTACAO E IMPORTACAO LTDA",
        "tradeName": "COSTA CAFE COMERCIO EXPORTACAO E IMPORTACAO LTDA",
        "cnpj": "54122775000401",
        "stateRegistration": "0145778670174",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ETR  ALBERTINA A E S PINHAL",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": null,
        "city": "ALBERTINA",
        "state": "MG",
        "postalCode": "37596000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "CULTUR COMERCIAL DE GRAOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 141.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "CULTUR COMERCIAL DE GRAOS LTDA",
        "tradeName": "CULTUR COMERCIAL DE GRAOS LTDA",
        "cnpj": "22010233000299",
        "stateRegistration": "0037401540070",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA CELINA FERREIRA OTTONI",
        "addressNumber": "518",
        "addressComplement": null,
        "district": "REZENDE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37062170",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "D M & M TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 344.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "D M & M TRANSPORTES LTDA",
        "tradeName": "D M & M TRANSPORTES LTDA",
        "cnpj": "49322677000135",
        "stateRegistration": "0045316040031",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA SALIME NACIF",
        "addressNumber": "321",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902051",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "D&G INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 441.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "D&G INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "CAFE MINHA TERRA",
        "cnpj": "54400705000125",
        "stateRegistration": "201320908",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ESTRADA 114",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "CH DE RECREIO SAO JOAQUIM",
        "city": "GOIANIA",
        "state": "GO",
        "postalCode": "74470220",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DIAMANTE EXPORTACAO E IMPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 58.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DIAMANTE EXPORTACAO E IMPORTACAO LTDA",
        "tradeName": "DIAMANTE CAFE",
        "cnpj": "11505607000140",
        "stateRegistration": "0020250580071",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA FELIPE NACIF",
        "addressNumber": "52",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36900000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DIAMANTE ORIGENS CORRETORA DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 59.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DIAMANTE ORIGENS CORRETORA DE CAFE LTDA",
        "tradeName": "DIAMANTE ORIGENS CORRETORA",
        "cnpj": "43206944000203",
        "stateRegistration": "0041448100054",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA GERALDO PEREIRA",
        "addressNumber": "220A",
        "addressComplement": null,
        "district": "POUSO ALEGRE",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36904079",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DIEGO DE SOUSA NOVAIS 10776752677",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 67.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DIEGO DE SOUSA NOVAIS 10776752677",
        "tradeName": "MC COMERCIO E EXPORTACAO DE CA",
        "cnpj": "30609264000108",
        "stateRegistration": "0032044700069",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ANTENOR FERREIRA ALENCAR",
        "addressNumber": "66",
        "addressComplement": null,
        "district": "VILA SAO JOSE",
        "city": "NOVA RESENDE",
        "state": "MG",
        "postalCode": "37860000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DIMENSAO INTERMEDIACOES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 272.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DIMENSAO INTERMEDIACOES LTDA",
        "tradeName": "DIMENSAO INTERMEDIACOES LTDA",
        "cnpj": "62744657000110",
        "stateRegistration": "129237116",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R 10 LETRA B",
        "addressNumber": "1",
        "addressComplement": null,
        "district": "JARDIM SAO CRISTOVAO",
        "city": "SAO LUIS",
        "state": "MA",
        "postalCode": "65055376",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DINAMO INTER-AGRICOLA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 405.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DINAMO INTER-AGRICOLA LTDA",
        "tradeName": "DINAMO",
        "cnpj": "56851611000106",
        "stateRegistration": "3905348780028",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 267",
        "addressNumber": "1321",
        "addressComplement": null,
        "district": "-",
        "city": "MACHADO",
        "state": "MG",
        "postalCode": "37750000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DLG COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 159.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DLG COMERCIO DE CAFE LTDA",
        "tradeName": "DLG COMERCIO DE CAFE",
        "cnpj": "60551049000164",
        "stateRegistration": "0051823730060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA MG KM 446",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "MORRO PRETO",
        "city": "MUZAMBINHO",
        "state": "MG",
        "postalCode": "37890000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DOIS IRMAOS CEREAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 287.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DOIS IRMAOS CEREAIS LTDA",
        "tradeName": "DOIS IRMAOS CEREAIS LTDA",
        "cnpj": "62687845000154",
        "stateRegistration": "0053029070069",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "BENEDITO MATIAS DE OLIVEIRA",
        "addressNumber": "297",
        "addressComplement": null,
        "district": "SAO LUIZ",
        "city": "CONGONHAS",
        "state": "MG",
        "postalCode": "36412482",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DOLCE COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 119.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DOLCE COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "DOLCE COFFEE EXPORTACAO",
        "cnpj": "27409203000192",
        "stateRegistration": "0029390700078",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MARIETA ALMEIDA",
        "addressNumber": "443",
        "addressComplement": null,
        "district": "SANTA LUIZA",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026660",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DORNA COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 171.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DORNA COMERCIO DE CAFE LTDA",
        "tradeName": "DORNA COMERCIO DE CAFE LTDA",
        "cnpj": "30995516000184",
        "stateRegistration": "0032372870050",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV. GENERAL ASTOLFO FERREIRA MENDES",
        "addressNumber": "1840",
        "addressComplement": null,
        "district": "MORADA DO SOL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38744608",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DUMONT COMERCIO ATACADISTA DE ALIMENTOS EM GERAL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 37.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DUMONT COMERCIO ATACADISTA DE ALIMENTOS EM GERAL LTDA",
        "tradeName": "DUMONT COMERCIO ATACADISTA DE",
        "cnpj": "22261918000127",
        "stateRegistration": "295300264",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "QUADRA ASR NE 25 ALAMEDA 1",
        "addressNumber": "05",
        "addressComplement": null,
        "district": "PLANO DIRETOR NORTE",
        "city": "PALMAS",
        "state": "TO",
        "postalCode": "77006318",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "DUMONT COMERCIO ATACADISTA DE ALIMENTOS EM GERAL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 46.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "DUMONT COMERCIO ATACADISTA DE ALIMENTOS EM GERAL LTDA",
        "tradeName": "DUMONT COMERCIO ATACADISTA DE",
        "cnpj": "22261918000470",
        "stateRegistration": "0050502380004",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA FRANCISCO FAEYER SOBRINHO",
        "addressNumber": "550",
        "addressComplement": null,
        "district": "SANTOS DUMONT",
        "city": "JUIZ DE FORA",
        "state": "MG",
        "postalCode": "36038265",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ELCIANO JORDAO PIMENTEL",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 167.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ELCIANO JORDAO PIMENTEL",
        "tradeName": "ELCIANO JORDAO PIMENTEL",
        "cnpj": "11077290000198",
        "stateRegistration": "0013591990060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA AURINO CIRILO DA COSTA",
        "addressNumber": "495",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902266",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ELIANE DA SILVA CORREA 48692263168",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 424.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ELIANE DA SILVA CORREA 48692263168",
        "tradeName": "ELIANE DA SILVA CORREA 48692263168",
        "cnpj": "23733032000100",
        "stateRegistration": "00136040888",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA GALDINO PIMENTEL",
        "addressNumber": "95",
        "addressComplement": null,
        "district": "CENTRO-NORTE",
        "city": "CUIABA",
        "state": "MT",
        "postalCode": "78005020",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ELLO COMERCIO DE CEREAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 16.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ELLO COMERCIO DE CEREAIS LTDA",
        "tradeName": "ELLO COMERCIO DE CEREAIS",
        "cnpj": "45686506000134",
        "stateRegistration": "0042956600010",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE MARIANO",
        "addressNumber": "141",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CAMACHO",
        "state": "MG",
        "postalCode": "35555000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EMERICK COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 157.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EMERICK COMERCIO DE CAFE LTDA",
        "tradeName": "EMERICK COMERCIO DE CAFE",
        "cnpj": "30095602000130",
        "stateRegistration": "0031637820038",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO SAO SEBASTIAO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36900000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EMPORIO PRODUTOS ALIMENTICIOS LTDA ME",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 213.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EMPORIO PRODUTOS ALIMENTICIOS LTDA ME",
        "tradeName": "EMPORIO",
        "cnpj": "23317520000128",
        "stateRegistration": "0026309490044",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA REVERENDO URIEL DE ALMEIDA LEITAO, S/N",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "NOSSA SENHORA DAS GRACAS",
        "city": "CARATINGA",
        "state": "MG",
        "postalCode": "35302770",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EP CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 198.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EP CAFE LTDA",
        "tradeName": "EP CAFE",
        "cnpj": "55707985000181",
        "stateRegistration": "0049286090030",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JUSTINA GUERRA DELICATTI",
        "addressNumber": "415",
        "addressComplement": null,
        "district": "NOVA ITAMOGI",
        "city": "ITAMOGI",
        "state": "MG",
        "postalCode": "37973000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EUROFORTE EXPORTADORA E INTERMEDIACOES DE COMMODITIES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 361.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EUROFORTE EXPORTADORA E INTERMEDIACOES DE COMMODITIES LTDA",
        "tradeName": "EUROFORTE EXPORTADORA E INTERMEDIACOES DE COMMODITIES LTDA",
        "cnpj": "42954305000182",
        "stateRegistration": "3168545940084",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUXEMBURGO",
        "addressNumber": "2260",
        "addressComplement": null,
        "district": "NACOES",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38745104",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EXCELENCIA EXPORTADORA E IMPORTADORA DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 177.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EXCELENCIA EXPORTADORA E IMPORTADORA DE CAFE LTDA",
        "tradeName": "EXCELENCIA EXPORTADORA E IMPOR",
        "cnpj": "50372623000163",
        "stateRegistration": "0045980300015",
        "municipalRegistration": null,
        "email": "fiscal@excelenciacorporation.com.br",
        "phone": null,
        "addressLine": "CORREGO CERVO",
        "addressNumber": "1",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "NEPOMUCENO",
        "state": "MG",
        "postalCode": "37250000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EXPEDICAO CAFE COMERCIO E CONSULTORIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 182.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EXPEDICAO CAFE COMERCIO E CONSULTORIA LTDA",
        "tradeName": "EXPEDICAO CAFE COMERCIO E CONS",
        "cnpj": "45509272000230",
        "stateRegistration": "0049579750025",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DO CONTORNO",
        "addressNumber": "2905",
        "addressComplement": null,
        "district": "SANTA EFIGENIA",
        "city": "BELO HORIZONTE",
        "state": "MG",
        "postalCode": "30110915",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EXPOCACER - COOPERATIVA DOS CAFEICULTORES DO CERRADO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 430.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EXPOCACER - COOPERATIVA DOS CAFEICULTORES DO CERRADO LTDA",
        "tradeName": "EXPOCACCER",
        "cnpj": "71352553000828",
        "stateRegistration": "4818651090760",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CATUAI",
        "addressNumber": "800",
        "addressComplement": null,
        "district": "CAFE MINEIRO",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38740001",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EXPOCACER COOPERATIVA DOS CAFEICULTORES DO CERRADO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 429.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EXPOCACER COOPERATIVA DOS CAFEICULTORES DO CERRADO LTDA",
        "tradeName": "EXPOCACCER",
        "cnpj": "71352553000151",
        "stateRegistration": "4818651090018",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV FARIA PEREIRA",
        "addressNumber": "3945",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38740514",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EXPOCACER COOPERATIVA DOS CAFEICULTORES DO CERRADO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 440.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EXPOCACER COOPERATIVA DOS CAFEICULTORES DO CERRADO LTDA",
        "tradeName": "EXPOCACCER",
        "cnpj": "71352553000232",
        "stateRegistration": "4818651090190",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV. MARCIANO PIRES",
        "addressNumber": "1293",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38740000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EXPORTADORA DE CAFE GUAXUPE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 100.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EXPORTADORA DE CAFE GUAXUPE LTDA",
        "tradeName": "EXPORTADORA DE CAFE GUAXUPE LTDA",
        "cnpj": "20775003000104",
        "stateRegistration": "2870488490081",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE AUGUSTO RIBEIRO DO VALE",
        "addressNumber": "955",
        "addressComplement": null,
        "district": "ANGOLA",
        "city": "GUAXUPE",
        "state": "MG",
        "postalCode": "37800000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "EXPORTADORA E IMPORTADORA MATSUDA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 34.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "EXPORTADORA E IMPORTADORA MATSUDA LTDA",
        "tradeName": "EXPORTADORA E IMPORTADORA MATSUDA LTDA",
        "cnpj": "57978292000400",
        "stateRegistration": "396183372115",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA EUCLIDES DA CUNHA",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "AREA RURAL DE JALES",
        "city": "JALES",
        "state": "SP",
        "postalCode": "15709899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FAMILIA LUCIANO COMERCIO DE CAFE LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 38.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FAMILIA LUCIANO COMERCIO DE CAFE LTDA.",
        "tradeName": "FAMILIA LUCIANO COMERCIO DE CAFE LTDA.",
        "cnpj": "47274142000100",
        "stateRegistration": "0043984560001",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JOAQUIM ROQUE",
        "addressNumber": "97",
        "addressComplement": null,
        "district": "SANTA CRUZ",
        "city": "MONSENHOR PAULO",
        "state": "MG",
        "postalCode": "37405000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FELIPE ALVES GOMES TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 347.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 14.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FELIPE ALVES GOMES TRANSPORTES LTDA",
        "tradeName": "F A G TRANSPORTES",
        "cnpj": "49290511000184",
        "stateRegistration": "0045295930025",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "PRACA EUZEBIO GONCALVES DUTRA",
        "addressNumber": "128",
        "addressComplement": null,
        "district": "SAO PEDRO DO AVAI",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36909500",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FERLIM COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 367.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FERLIM COMERCIO DE CAFE LTDA",
        "tradeName": "FERLIM COMERCIO DE CAFE",
        "cnpj": "43227326000169",
        "stateRegistration": "0041299870007",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA FERNANDO MAURILIO LOPES",
        "addressNumber": "52",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SAO JOAO DO MANHUACU",
        "state": "MG",
        "postalCode": "36918000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FERREIRA COFFEE COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 60.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FERREIRA COFFEE COMERCIO DE CAFE LTDA",
        "tradeName": "FERREIRA COFFEE COMERCIO DE CA",
        "cnpj": "33105918000154",
        "stateRegistration": "0036154410000",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOAO GABRIEL DE MELO",
        "addressNumber": "20",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "ALBERTINA",
        "state": "MG",
        "postalCode": "37596000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FH & MARTINS TRANSPORTES PARAISO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 438.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FH & MARTINS TRANSPORTES PARAISO LTDA",
        "tradeName": "FH & MARTINS TRANSPORTES PARAISO LTDA",
        "cnpj": "12932443000280",
        "stateRegistration": "415080106119",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ALBINO ROEL",
        "addressNumber": "127",
        "addressComplement": null,
        "district": "JARDIM RESIDENCIAL MARIANA",
        "city": "LEME",
        "state": "SP",
        "postalCode": "13611220",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FILHO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 366.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FILHO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA",
        "tradeName": "FILHO ALIMENTOS",
        "cnpj": "06073298000146",
        "stateRegistration": "103712488",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SANTA TEREZA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "SETOR SANTA LUZIA",
        "city": "PORANGATU",
        "state": "GO",
        "postalCode": "76550000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FINO SABOR INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 144.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FINO SABOR INDUSTRIA E COMERCIO LTDA",
        "tradeName": "FINO SABOR INDUSTRIA E COMERCIO LTDA",
        "cnpj": "00354138000199",
        "stateRegistration": "0169279850049",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ALBERTO VIEIRA ROMAO",
        "addressNumber": "1045",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37130001",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FLOR DE MINAS COFFEE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 40.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FLOR DE MINAS COFFEE LTDA",
        "tradeName": "FLOR DE MINAS COFFEE LTDA",
        "cnpj": "47704450000129",
        "stateRegistration": "0044247880047",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DOUTOR ALCEBIADES VIANA DE PAULA",
        "addressNumber": "155",
        "addressComplement": null,
        "district": "PARQUE URUPES",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37062525",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FLYING COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 292.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FLYING COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "FLYING COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
        "cnpj": "33596965000148",
        "stateRegistration": "0034431390081",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA TUPARI",
        "addressNumber": "81",
        "addressComplement": null,
        "district": "RESIDENCIAL TEIXEIRA",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37132354",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FONSECA COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 382.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FONSECA COMERCIO DE CAFE LTDA",
        "tradeName": "FONSECA COMERCIO DE CAFE LTDA",
        "cnpj": "23985517000182",
        "stateRegistration": "0030552000078",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO DOS PEROBAS",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "CARATINGA",
        "state": "MG",
        "postalCode": "35300970",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FORTE COMERCIO ATACADISTA DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 20.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FORTE COMERCIO ATACADISTA DE CAFE LTDA",
        "tradeName": "FORTE COMERCIO ATACADISTA DE C",
        "cnpj": "45156520000126",
        "stateRegistration": "528282539116",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA VEREADOR JOSE FRANCISCO MACHADO",
        "addressNumber": "63",
        "addressComplement": null,
        "district": "CENTRO MOREIRA CESAR",
        "city": "PINDAMONHANGABA",
        "state": "SP",
        "postalCode": "12441060",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FORTE GRAO - COMERCIO, IMPORTACAO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 400.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FORTE GRAO - COMERCIO, IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "FORTE GRAO - COMERCIO, IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "cnpj": "14909045000198",
        "stateRegistration": "0019018680095",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA TUPARI",
        "addressNumber": "74",
        "addressComplement": null,
        "district": "RESIDENCIAL TEIXEIRA",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37132354",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FORTE GRAO CORRETORA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 437.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FORTE GRAO CORRETORA LTDA",
        "tradeName": "FORTE GRAO CORRETORA LTDA",
        "cnpj": "65535933000129",
        "stateRegistration": "0054800320070",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV MARIQUINHA AMORELLI",
        "addressNumber": "115",
        "addressComplement": null,
        "district": "MARCIOLANDIA",
        "city": "NEPOMUCENO",
        "state": "MG",
        "postalCode": "37250000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FRANCA CAFE LTDA",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 2. Documento exibido no relatorio: 19.813.454-00 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 2.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FRANCA CAFE LTDA",
        "tradeName": "CAFEEIRA FRANCA",
        "cnpj": "19813454000100",
        "stateRegistration": "083015949",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA FRANCISCO STOCKL KM 7,5",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SANTA MARIA",
        "city": "MARECHAL FLORIANO",
        "state": "ES",
        "postalCode": "29259000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FRANKLIN ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 220.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FRANKLIN ARMAZENS GERAIS LTDA",
        "tradeName": "FRANKLIN ARMAZENS",
        "cnpj": "31391833000154",
        "stateRegistration": "0032666230058",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA FRANCISCO FIALHO",
        "addressNumber": "20",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902054",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FRANKLIN COFFEE COMERCIO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 168.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FRANKLIN COFFEE COMERCIO E EXPORTACAO LTDA",
        "tradeName": "FRANKLIN COFFEE",
        "cnpj": "28262320000139",
        "stateRegistration": "0038112700052",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA FRANCISCO FIALHO",
        "addressNumber": "20",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902054",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FRUTOS ESPECIAIS COMERCIO DE CAFE LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 390.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FRUTOS ESPECIAIS COMERCIO DE CAFE LTDA.",
        "tradeName": "FRUTOS ESPECIAIS COMERCIO DE C",
        "cnpj": "31197819000114",
        "stateRegistration": "0032528280068",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOAO FERNANDES DOS REIS",
        "addressNumber": "1650",
        "addressComplement": null,
        "district": "CACHOEIRINHA",
        "city": "NATERCIA",
        "state": "MG",
        "postalCode": "37524000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FUTURA COMERCIO ATACADISTA LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 13.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FUTURA COMERCIO ATACADISTA LTDA",
        "tradeName": "FUTURA COMERCIO ATACADISTA LTD",
        "cnpj": "33947549000147",
        "stateRegistration": "084112565",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ROD. COSTA AGOSTINHO",
        "addressNumber": "102",
        "addressComplement": null,
        "district": "SAGRADA FAMILIA",
        "city": "ALFREDO CHAVES",
        "state": "ES",
        "postalCode": "29240000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "FUTURA COMERCIO ATACADISTA LTDA - FILIAL",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 31.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "FUTURA COMERCIO ATACADISTA LTDA - FILIAL",
        "tradeName": "FUTURA COMERCIO ATACADISTA LTD",
        "cnpj": "33947549000228",
        "stateRegistration": "085008397",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PROJETADA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "SAO BENTO DO JUCU",
        "city": "DOMINGOS MARTINS",
        "state": "ES",
        "postalCode": "29260000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "G F DA SILVA TORREFACAO E MOAGEM",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 36.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "G F DA SILVA TORREFACAO E MOAGEM",
        "tradeName": "G F DA SILVA TORREFACAO E MOAGEM",
        "cnpj": "04852445000150",
        "stateRegistration": "6761601680040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ESTRADA MUNICIPAL",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SIMONESIA",
        "state": "MG",
        "postalCode": "36930000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GAP COFFEE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 251.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GAP COFFEE LTDA",
        "tradeName": "GAP COFFEE",
        "cnpj": "31999405000109",
        "stateRegistration": "0033159710092",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FAZENDA BOM DESCANSO",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "ALPINOPOLIS",
        "state": "MG",
        "postalCode": "37940000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GARDINGO TRADE IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 450.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GARDINGO TRADE IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "GARDINGO TRADE",
        "cnpj": "00681184000100",
        "stateRegistration": "4099632320017",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FAZENDA SANTA MARIA",
        "addressNumber": "03",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "MATIPO",
        "state": "MG",
        "postalCode": "35367000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GCG GILVANI CORRETORA DE GRAOS E COM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 49.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GCG GILVANI CORRETORA DE GRAOS E COM LTDA",
        "tradeName": "GCG GILVANI CORRETORA DE GRAOS E COM LTDA",
        "cnpj": "24854552000125",
        "stateRegistration": "0027648580055",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA INFANTE VIEIRA",
        "addressNumber": "2705",
        "addressComplement": null,
        "district": "SAO BENEDITO",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38740001",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GENERAL MOUNTAINS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 173.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GENERAL MOUNTAINS LTDA",
        "tradeName": "GENERAL MOUNTAINS",
        "cnpj": "02544700000253",
        "stateRegistration": "0048248260089",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA VEREADOR SEBASTIAO PRADO LUZ",
        "addressNumber": "50",
        "addressComplement": null,
        "district": "CHAPADAO",
        "city": "CABO VERDE",
        "state": "MG",
        "postalCode": "37880000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GILDO BORGES DE SIQUEIRA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 57.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GILDO BORGES DE SIQUEIRA LTDA",
        "tradeName": "MACHADO COMISSARIA DE CAFE",
        "cnpj": "02675896000134",
        "stateRegistration": "3902497140052",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CAPITAO JOAO PEREIRA DO VALE",
        "addressNumber": "107",
        "addressComplement": null,
        "district": "CORONEL RENNO",
        "city": "JACUTINGA",
        "state": "MG",
        "postalCode": "37590000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GIRO COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 39.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GIRO COMERCIO DE CAFE LTDA",
        "tradeName": "GIRO CAFE",
        "cnpj": "36819710000195",
        "stateRegistration": "0037044430082",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MINAS GERAIS",
        "addressNumber": "358",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "TRES PONTAS",
        "state": "MG",
        "postalCode": "37185058",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GIRO GRAO, GIRO CAR E GIRO IMOVEIS COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 252.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GIRO GRAO, GIRO CAR E GIRO IMOVEIS COMERCIO LTDA",
        "tradeName": "GIRO GRAO, GIRO CAR E GIRO IMO",
        "cnpj": "02608558000180",
        "stateRegistration": "0010352970006",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FAZENDA SUMIDOURO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "AGUANIL",
        "state": "MG",
        "postalCode": "37273000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GP SOMOS CEREAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 381.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GP SOMOS CEREAIS LTDA",
        "tradeName": "GP SOMOS CEREAIS LTDA",
        "cnpj": "63209204000238",
        "stateRegistration": "396191853111",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "EST. INTERMUNICIPAL JALES PONTALINDA",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "AREA RURAL DE JALES",
        "city": "JALES",
        "state": "SP",
        "postalCode": "15709899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAN CAFE COMERCIO IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 470.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAN CAFE COMERCIO IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "GRAN CAFE COMERCIO IMPORTACAO",
        "cnpj": "45244420000151",
        "stateRegistration": "0042667750020",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA SANTA HELENA",
        "addressNumber": "244",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "CAPUTIRA",
        "state": "MG",
        "postalCode": "36925000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRANVIVA COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 307.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRANVIVA COMERCIO DE CAFE LTDA",
        "tradeName": "GRANVIVA COMERCIO DE CAFE",
        "cnpj": "61950074000183",
        "stateRegistration": "0052611900086",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA WADI ASSAD",
        "addressNumber": "203",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902305",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAO   GRAO COMERCIO EXP LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 90.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAO   GRAO COMERCIO EXP LTDA",
        "tradeName": "GRAO   GRAO COMERCIO EXP",
        "cnpj": "16594876000739",
        "stateRegistration": "295503050",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV CONDORCET",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "JARDIM AMERICA",
        "city": "PORTO NACIONAL",
        "state": "TO",
        "postalCode": "77500000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAO & GRAO COMERCIO EXP LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 4.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAO & GRAO COMERCIO EXP LTDA",
        "tradeName": "GRAO & GRAO COMERCIO EXP LTDA",
        "cnpj": "16594876000577",
        "stateRegistration": "201609649",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ARAGUAIA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "SUDOESTE",
        "city": "CRISTALINA",
        "state": "GO",
        "postalCode": "73850000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAO DO AGRESTE INDUSTRIA E COMERCIO DE CAFE, ESPECIARIAS, TEMPEROS E",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 383.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAO DO AGRESTE INDUSTRIA E COMERCIO DE CAFE, ESPECIARIAS, TEMPEROS E",
        "tradeName": "GRAO DO AGRESTE LTDA",
        "cnpj": "61871502000182",
        "stateRegistration": "126402205",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JULIO BRASILEIRO",
        "addressNumber": "55",
        "addressComplement": null,
        "district": "HELIOPOLIS",
        "city": "GARANHUNS",
        "state": "PE",
        "postalCode": "55295475",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAO SUL DE MINAS REBENEFICIO E ARMAZENAGEM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 227.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAO SUL DE MINAS REBENEFICIO E ARMAZENAGEM LTDA",
        "tradeName": "GRAO SUL DE MINAS REBENEFICIO E ARMAZENAGEM LTDA",
        "cnpj": "35258402000175",
        "stateRegistration": "0035761170035",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ADAO FORTUNATO",
        "addressNumber": "30",
        "addressComplement": null,
        "district": "PARK RINALDO",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37036500",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAOS DA TERRA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 237.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAOS DA TERRA LTDA",
        "tradeName": "GRAOS DA TERRA",
        "cnpj": "60161952000119",
        "stateRegistration": "374182833110",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SAO JOSE",
        "addressNumber": "218",
        "addressComplement": null,
        "district": "SANTA CRUZ",
        "city": "ITAPIRA",
        "state": "SP",
        "postalCode": "13974290",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAOS DE MINAS TRADING LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 72.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAOS DE MINAS TRADING LTDA",
        "tradeName": "GRAOS DE MINAS TRADING LTDA",
        "cnpj": "46289180000174",
        "stateRegistration": "0043350100015",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R AMERICO VESPUCIO DE CARVALHO",
        "addressNumber": "225",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "ESPERA FELIZ",
        "state": "MG",
        "postalCode": "36830000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAOS DOURADOS COMERCIO E BENEFICIAMENTO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 121.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAOS DOURADOS COMERCIO E BENEFICIAMENTO LTDA",
        "tradeName": "GRAOS DOURADOS COMERCIO E BENE",
        "cnpj": "12106468000144",
        "stateRegistration": "0016165730019",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R AVELINO DE ANDRADE PINHEIRO",
        "addressNumber": "31",
        "addressComplement": null,
        "district": "VL JARDIM N. SA DE FATIMA",
        "city": "SAO JOAO DEL REI",
        "state": "MG",
        "postalCode": "36305340",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAOS DOURADOS DISTRIBUIDORA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 471.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAOS DOURADOS DISTRIBUIDORA LTDA",
        "tradeName": "GRAOS DOURADOS DISTRIBUIDORA L",
        "cnpj": "12106468000225",
        "stateRegistration": "0055441510099",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R PROFESSOR OSWALDO VELOSO",
        "addressNumber": "114",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "JUIZ DE FORA",
        "state": "MG",
        "postalCode": "36060090",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GRAOS REIS COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 472.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GRAOS REIS COMERCIO LTDA",
        "tradeName": "GRAOS REIS COMERCIO",
        "cnpj": "67242196000100",
        "stateRegistration": "55552950003",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JACOB LOPES DE CASTRO",
        "addressNumber": "710",
        "addressComplement": null,
        "district": "NOVA ERA",
        "city": "VICOSA",
        "state": "MG",
        "postalCode": "36574192",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GREEN TRADE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 192.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GREEN TRADE LTDA",
        "tradeName": "GREEN TRADE",
        "cnpj": "35039092000106",
        "stateRegistration": "0035578860060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DO COMERCIO DE CAFE",
        "addressNumber": "101",
        "addressComplement": null,
        "district": "INDUSTRIAL REINALDO FORESTI",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026530",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GS ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 122.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GS ARMAZENS GERAIS LTDA",
        "tradeName": "GS ARMAZENS GERAIS",
        "cnpj": "03570110000187",
        "stateRegistration": "7070578660025",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DOS IMIGRANTES",
        "addressNumber": "1340",
        "addressComplement": null,
        "district": "JARDIM CIDADE NOVA",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37022560",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "GV COMERCIO DE CAFE",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 326.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "GV COMERCIO DE CAFE",
        "tradeName": "GV COMERCIO DE CAFE",
        "cnpj": "18667956000107",
        "stateRegistration": "3901540990040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DOM HUGO",
        "addressNumber": "34",
        "addressComplement": null,
        "district": "OURO VERDE",
        "city": "MACHADO",
        "state": "MG",
        "postalCode": "37750000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "H M CORRETORA DE CAFE E DEPOSITOS DE MERCADORIAS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 185.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "H M CORRETORA DE CAFE E DEPOSITOS DE MERCADORIAS LTDA",
        "tradeName": "H M CORRETORA DE CAFE E DEPOSITOS DE MERCADORIAS LTDA",
        "cnpj": "02623061000130",
        "stateRegistration": "0020025270087",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA THEOCRITO PINHEIRO",
        "addressNumber": "145",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902287",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "H.L. DO BRASIL INDUSTRIA E COMERCIO DE PRODUTOS ALIMENTICIOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 98.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "H.L. DO BRASIL INDUSTRIA E COMERCIO DE PRODUTOS ALIMENTICIOS LTDA",
        "tradeName": "KININO",
        "cnpj": "00573184000502",
        "stateRegistration": "451088984113",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ESTRADA MUNICIPAL MAURO SACCHI",
        "addressNumber": "0",
        "addressComplement": null,
        "district": "PERIMETRO URBANO",
        "city": "MIRASSOL",
        "state": "SP",
        "postalCode": "15138899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "HERMES IMPORTACAO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 81.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "HERMES IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "HERMES IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "cnpj": "12964518000124",
        "stateRegistration": "0017019130054",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FELIPE NACIF",
        "addressNumber": "33",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36900000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "HV TRANSPORTES E LOGISTICA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 373.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "HV TRANSPORTES E LOGISTICA LTDA",
        "tradeName": "H V TRANSPORTES E LOGISTICA",
        "cnpj": "59195366000106",
        "stateRegistration": "0051040690050",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SAO SIMAO",
        "addressNumber": "42",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902269",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "I D S COFFEE COMERCIO DE CAFE LTDA EPP",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 448.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "I D S COFFEE COMERCIO DE CAFE LTDA EPP",
        "tradeName": "I D S COFFEE",
        "cnpj": "22678703000106",
        "stateRegistration": "025773690004",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R CANADA",
        "addressNumber": "88",
        "addressComplement": null,
        "district": "JD AMERICA",
        "city": "MUZAMBINHO",
        "state": "MG",
        "postalCode": "37890000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ICATRIL INDUSTRIA DE CAFE DO TRIANGULO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 435.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ICATRIL INDUSTRIA DE CAFE DO TRIANGULO LTDA",
        "tradeName": "ICATRIL INDUSTRIA DE CAFE DO TRIANGULO LTDA",
        "cnpj": "25758277000109",
        "stateRegistration": "7020623760003",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JOSE ANDRAUS GASSANI",
        "addressNumber": "4700",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "UBERLANDIA",
        "state": "MG",
        "postalCode": "38402324",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "IF COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 325.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "IF COMERCIO DE CAFE LTDA",
        "tradeName": "GRAO MINAS COMERCIO DE CAFE",
        "cnpj": "47893849000103",
        "stateRegistration": "0044372820038",
        "municipalRegistration": null,
        "email": "iuryfmendes77@gmail.com",
        "phone": null,
        "addressLine": "AVENIDA CAPITAO ANTONIO CARLOS DE SOUZA",
        "addressNumber": "1470",
        "addressComplement": null,
        "district": "SANTA MARIA",
        "city": "CARANGOLA",
        "state": "MG",
        "postalCode": "36800000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "IMPERIO COFFEE COM. IMP. E EXP. DE CAFE",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 463.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "IMPERIO COFFEE COM. IMP. E EXP. DE CAFE",
        "tradeName": "IMPERIO COFFEE COM. IMP. E EXP",
        "cnpj": "26298728000135",
        "stateRegistration": "0028420320030",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA PREFEITO JOSE EVILASIO ASSI",
        "addressNumber": "316 A",
        "addressComplement": null,
        "district": "NOVA GIMIRIM",
        "city": "POCO FUNDO",
        "state": "MG",
        "postalCode": "37757000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "IMPERIO TRANSPORTE E COMERCIO DE CAFE S/A",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 18.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "IMPERIO TRANSPORTE E COMERCIO DE CAFE S/A",
        "tradeName": "IMPERIO TRANSPORTE E COMERCIO",
        "cnpj": "07891454000149",
        "stateRegistration": "082379947",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA SILVIO AVIDOS",
        "addressNumber": "2226",
        "addressComplement": null,
        "district": "SAO SILVANO",
        "city": "COLATINA",
        "state": "ES",
        "postalCode": "29706298",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA & COMERCIO CAFE OURO VERDE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 360.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA & COMERCIO CAFE OURO VERDE LTDA",
        "tradeName": "MOAGEM OURO VERDE",
        "cnpj": "11701000000135",
        "stateRegistration": "007906218",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA FRANCISCO BRAGA",
        "addressNumber": "250",
        "addressComplement": null,
        "district": "HELIOPOLIS",
        "city": "GARANHUNS",
        "state": "PE",
        "postalCode": "55298320",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA BRUNELLI LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 308.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA BRUNELLI LTDA",
        "tradeName": "INDUSTRIA BRUNELLI LTDA",
        "cnpj": "18118612000149",
        "stateRegistration": "3422182850028",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CRISTINA DINIZ FRANCA",
        "addressNumber": "83",
        "addressComplement": null,
        "district": "NOSSA SENHORA APARECIDA",
        "city": "ITUIUTABA",
        "state": "MG",
        "postalCode": "38301207",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA DE CAFE OJUARA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 352.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA DE CAFE OJUARA LTDA",
        "tradeName": "CAFE OJUARA",
        "cnpj": "41553769000114",
        "stateRegistration": "068737874",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JOAO INACIO DE LUCENA",
        "addressNumber": "1174",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "BREJO SANTO",
        "state": "CE",
        "postalCode": "63260000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA DE CAFE PARACATU LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 345.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA DE CAFE PARACATU LTDA",
        "tradeName": "CAFE CATU",
        "cnpj": "19644798000132",
        "stateRegistration": "4701348790071",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DO CURTUME",
        "addressNumber": "303",
        "addressComplement": null,
        "district": "PARACATUZINHO",
        "city": "PARACATU",
        "state": "MG",
        "postalCode": "38600001",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA DE PRODUTOS ALIMENTICIOS CUPIDO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 362.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA DE PRODUTOS ALIMENTICIOS CUPIDO LTDA",
        "tradeName": "INDUSTRIA DE PRODUTOS ALIMENTI",
        "cnpj": "10350890000115",
        "stateRegistration": "001071238",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA HEITOR DOS PRAZERES",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "HELIOPOLIS",
        "city": "GARANHUNS",
        "state": "PE",
        "postalCode": "55291000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA E COMERCIO DE ALIMENTOS VO ITA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 476.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA E COMERCIO DE ALIMENTOS VO ITA LTDA",
        "tradeName": "CAFE PAI VOVO",
        "cnpj": "47716438000134",
        "stateRegistration": "164431802",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SALATIEL MARQUES FONTES",
        "addressNumber": "695-D",
        "addressComplement": null,
        "district": "ANDRE GADELHA",
        "city": "SOUSA",
        "state": "PB",
        "postalCode": "58806470",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA E COMERCIO DE CAFE CURUCA LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 314.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA E COMERCIO DE CAFE CURUCA LTDA.",
        "tradeName": "CAFE CURUCA",
        "cnpj": "51332641000346",
        "stateRegistration": "412004835117",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA MARECHAL RONDON",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SAO JOAO",
        "city": "LARANJAL PAULISTA",
        "state": "SP",
        "postalCode": "18500000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA E COMERCIO DE CAFE MINEIRENSE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 131.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA E COMERCIO DE CAFE MINEIRENSE LTDA",
        "tradeName": "CAFE SOUZA",
        "cnpj": "33255654000115",
        "stateRegistration": "102028222",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR-364",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "DAIM - DISTRITO AGRO INDUSTRIA",
        "city": "MINEIROS",
        "state": "GO",
        "postalCode": "75837165",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA E COMERCIO DE CAFE SERRA ALTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 341.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA E COMERCIO DE CAFE SERRA ALTA LTDA",
        "tradeName": "INDUSTRIA E COMERCIO DE CAFE SERRA ALTA LTDA",
        "cnpj": "73219024000452",
        "stateRegistration": "9083943219",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA AVENIDA LADISLAO GIL FERNANDEZ",
        "addressNumber": "3265",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "IVAIPORA",
        "state": "PR",
        "postalCode": "86870000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA E COMERCIO ESTRELA D ALVA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 348.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA E COMERCIO ESTRELA D ALVA LTDA",
        "tradeName": "CAFE ESTRELA D ALVA",
        "cnpj": "01494145000159",
        "stateRegistration": "100159290",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BRASILIA",
        "addressNumber": "2141",
        "addressComplement": null,
        "district": "1 S INDUSTRIAL",
        "city": "FORMOSA",
        "state": "GO",
        "postalCode": "73801310",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "INDUSTRIA, COMERCIO E EXPORTACAO DE CAFE MORAES LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 484.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "INDUSTRIA, COMERCIO E EXPORTACAO DE CAFE MORAES LTDA.",
        "tradeName": "INDUSTRIA, COMERCIO E EXPORTACAO DE CAFE MORAES LTDA.",
        "cnpj": "46041091000104",
        "stateRegistration": "244012497112",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ANA SANTINA PEREIRA",
        "addressNumber": "35",
        "addressComplement": null,
        "district": "CHACARAS SAO MARTINHO",
        "city": "CAMPINAS",
        "state": "SP",
        "postalCode": "13042832",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "IRMAOS CARNEIRO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 22.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "IRMAOS CARNEIRO LTDA",
        "tradeName": "CAFE CARNEIRO",
        "cnpj": "49790926000117",
        "stateRegistration": "372001121119",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOAO RIOS CARNEIRO",
        "addressNumber": "30",
        "addressComplement": null,
        "district": "JARDIM MARINGA",
        "city": "ITAPEVA",
        "state": "SP",
        "postalCode": "18407030",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "IRMAOS CARVALHO INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 146.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "IRMAOS CARVALHO INDUSTRIA E COMERCIO LTDA",
        "tradeName": "IRMAOS CARVALHO",
        "cnpj": "09292468000171",
        "stateRegistration": "0010575420022",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA FARIA PEREIRA",
        "addressNumber": "230",
        "addressComplement": null,
        "district": "MORADA DO SOL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38744880",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "IRMAOS MONTEIRO INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 412.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "IRMAOS MONTEIRO INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "IRMAOS MONTEIRO COMERCIO DE CA",
        "cnpj": "26434285000162",
        "stateRegistration": "0028547140018",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOAQUIM PINTO",
        "addressNumber": "598",
        "addressComplement": null,
        "district": "BATUQUE",
        "city": "MONTE CARMELO",
        "state": "MG",
        "postalCode": "38500000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "J B ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 266.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "J B ARMAZENS GERAIS LTDA",
        "tradeName": "J B ARMAZENS GERAIS LTDA",
        "cnpj": "33994135000179",
        "stateRegistration": "0034751220055",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO BOM SUCESSO",
        "addressNumber": "141",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SIMONESIA",
        "state": "MG",
        "postalCode": "36930000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "J D COFFEE COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 350.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "J D COFFEE COMERCIO DE CAFE LTDA",
        "tradeName": "J D COFFEE COMERCIO DE CAFE",
        "cnpj": "45719328000109",
        "stateRegistration": "0042978910186",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA AMELIO NEVES",
        "addressNumber": "100",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "AIMORES",
        "state": "MG",
        "postalCode": "35200000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "J. R. COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 92.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "J. R. COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "CAFE BRUMADO",
        "cnpj": "05438377000221",
        "stateRegistration": "0027897040020",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PONTAL",
        "addressNumber": "332",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ELOI MENDES",
        "state": "MG",
        "postalCode": "37110000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "JBM COMERCIO DE CAFE EM GRAOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 208.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "JBM COMERCIO DE CAFE EM GRAOS LTDA",
        "tradeName": "JBM ATACADISTA DE CAFE",
        "cnpj": "58271443000105",
        "stateRegistration": "0050517220024",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA VICENTE PICARDI",
        "addressNumber": "1002",
        "addressComplement": null,
        "district": "BELA VISTA",
        "city": "SAO ROQUE DE MINAS",
        "state": "MG",
        "postalCode": "37928000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "JH CAFE EIRELI",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 18. Documento exibido no relatorio: 35.762.278-80 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 12.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "JH CAFE EIRELI",
        "tradeName": "JH CAFE EIRELI",
        "cnpj": "35762278000180",
        "stateRegistration": "083623256",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ANTONIO JOSE DE FREITAS",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "SAO PEDRO DE RATES",
        "city": "GUACUI",
        "state": "ES",
        "postalCode": "29560000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "JLD COMERCIO E SERVICOS DE CAFE LTDA ME",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 283.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "JLD COMERCIO E SERVICOS DE CAFE LTDA ME",
        "tradeName": "JLD CAFE",
        "cnpj": "14247521000152",
        "stateRegistration": "0018350310057",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA GERALDO LAURINDO DE FREITAS",
        "addressNumber": "000",
        "addressComplement": null,
        "district": "DOS ALVES",
        "city": "MONTE SIAO",
        "state": "MG",
        "postalCode": "37580000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "JOSE LUCAS RIBEIRO",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 408.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "JOSE LUCAS RIBEIRO",
        "tradeName": "TORREFACAO E MOAGEM DE CAFE GO",
        "cnpj": "02126779000111",
        "stateRegistration": "100908128",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "VIA SECUNDARIA 02",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "DAIO",
        "city": "ORIZONA",
        "state": "GO",
        "postalCode": "75280000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "JS COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 374.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "JS COMERCIO DE CAFE LTDA",
        "tradeName": "JS CAFE",
        "cnpj": "15660460000113",
        "stateRegistration": "0019736030032",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA VENEZUELA",
        "addressNumber": "3044",
        "addressComplement": null,
        "district": "NACOES",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38745088",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "JURERE CAFFE COMERCIO DE ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 97.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "JURERE CAFFE COMERCIO DE ALIMENTOS LTDA",
        "tradeName": "CAFE JURERE",
        "cnpj": "00214257000146",
        "stateRegistration": "252947649",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA AUGUSTO BAYER",
        "addressNumber": "600",
        "addressComplement": null,
        "district": "PRACA",
        "city": "TIJUCAS",
        "state": "SC",
        "postalCode": "88200000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "KOFFERGRAO ATACADISTA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 363.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "KOFFERGRAO ATACADISTA E COMERCIO LTDA",
        "tradeName": "KOFFERGRAO ATACADISTA E COMERCIO LTDA",
        "cnpj": "32560986000493",
        "stateRegistration": "0046581440078",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DR. LICURGO LEITE FILHO",
        "addressNumber": "368",
        "addressComplement": null,
        "district": "JARDIM NOVO HORIZONTE",
        "city": "MUZAMBINHO",
        "state": "MG",
        "postalCode": "37890000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "L & A INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 433.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "L & A INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "CAFE INDIANOPOLIS",
        "cnpj": "04319685000194",
        "stateRegistration": "7021192330065",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ANTONIO THOMAZ FERREIRA REZENDE",
        "addressNumber": "5017",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "UBERLANDIA",
        "state": "MG",
        "postalCode": "38402349",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "LA INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 323.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "LA INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "CAFE PARAISO",
        "cnpj": "33410689000181",
        "stateRegistration": "290267226",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA TOMAS PARENTE",
        "addressNumber": "180",
        "addressComplement": null,
        "district": "PARQUE INDUSTRIAL ALVARO MILHOMEM",
        "city": "PARAISO DO TOCANTINS",
        "state": "TO",
        "postalCode": "77600000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "LAUDELINO JORGE RODRIGUES",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 469.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "LAUDELINO JORGE RODRIGUES",
        "tradeName": "ROMA ATACADISTA",
        "cnpj": "66257288000192",
        "stateRegistration": "1177663510017",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FAZENDA DA REPUBLICA",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "CANAA",
        "state": "MG",
        "postalCode": "36592000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "LIDER COMPRA E VENDA DE CAFE EIRELI",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 399.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "LIDER COMPRA E VENDA DE CAFE EIRELI",
        "tradeName": "LIDER COMPRA E VENDA DE CAFE E",
        "cnpj": "30612130000146",
        "stateRegistration": "0032047180082",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ROQUE PORCARO JUNIOR",
        "addressNumber": "313",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "LOPES COMERCIO DE CAFE E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 316.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "LOPES COMERCIO DE CAFE E EXPORTACAO LTDA",
        "tradeName": "LOPES CAFE",
        "cnpj": "13288090000100",
        "stateRegistration": "0017372310008",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RESIDENCIAL AVENIDA SINHA MOREIRA",
        "addressNumber": "200",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SANTA RITA DO SAPUCAI",
        "state": "MG",
        "postalCode": "37540000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "LR FREITAS DISTRIBUIDORA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 482.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "LR FREITAS DISTRIBUIDORA LTDA",
        "tradeName": "LR FREITAS DISTRIBUIDORA LTDA",
        "cnpj": "67710367000170",
        "stateRegistration": "0055723460005",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV PEDRO TIPONI",
        "addressNumber": "291",
        "addressComplement": null,
        "district": "NOVA BENFICA",
        "city": "JUIZ DE FORA",
        "state": "MG",
        "postalCode": "36091000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "LST TRANSPORTES  RODOVIARIO DE CARGAS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 96.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "LST TRANSPORTES  RODOVIARIO DE CARGAS LTDA",
        "tradeName": "LST TRANSPORTES  RODOVIARIO DE CARGAS LTDA",
        "cnpj": "80457377000103",
        "stateRegistration": "251835642",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ANTONIO BAYER",
        "addressNumber": "669",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "TIJUCAS",
        "state": "SC",
        "postalCode": "88200000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "M & G INDUSTRIA E COMERCIO DE CAFE LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 426.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "M & G INDUSTRIA E COMERCIO DE CAFE LTDA.",
        "tradeName": "CAFE VITORIA",
        "cnpj": "12647495000124",
        "stateRegistration": "0016739910057",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JOAO DE DEUS ANTUNES GOMES",
        "addressNumber": "19",
        "addressComplement": null,
        "district": "MOACIR SOARES TOLENTINO",
        "city": "ESPINOSA",
        "state": "MG",
        "postalCode": "39510000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "M&T COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 226.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "M&T COMERCIO DE CAFE LTDA",
        "tradeName": "M&T COMERCIO DE CAFE",
        "cnpj": "61040792000112",
        "stateRegistration": "0052096260060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA PRINCESA DO SUL",
        "addressNumber": "890",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026080",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MA SGARIO COMERCIO ATACADISTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 357.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MA SGARIO COMERCIO ATACADISTA LTDA",
        "tradeName": "MA SGARIO COMERCIO ATACADISTA LTDA",
        "cnpj": "48655352000101",
        "stateRegistration": "0047122850021",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA MAJOR PEREIRA",
        "addressNumber": "1217",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "ESPERA FELIZ",
        "state": "MG",
        "postalCode": "36830000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MAIS BRASIL COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 9.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MAIS BRASIL COMERCIO DE CAFE LTDA",
        "tradeName": "MAIS BRASIL CAFE",
        "cnpj": "05542869000181",
        "stateRegistration": "0162240750047",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CAMBUQUIRA",
        "addressNumber": "32",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026330",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MARTINS COMERCIO DE CAFE IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 145.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MARTINS COMERCIO DE CAFE IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "MARTINS COFFEE TRADING",
        "cnpj": "47876408000195",
        "stateRegistration": "0044360750021",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO DO TABULEIRO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SANTA RITA DE MINAS",
        "state": "MG",
        "postalCode": "35326000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MARTINS NOVAIS COMERCIO E EMPREENDIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 301.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MARTINS NOVAIS COMERCIO E EMPREENDIMENTOS LTDA",
        "tradeName": "MARTINS NOVAIS COMERCIO E EMPR",
        "cnpj": "61361344000110",
        "stateRegistration": "0052277890006",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SITIO CORREGO DOS COQUEIROS",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "NOVA RESENDE",
        "state": "MG",
        "postalCode": "37860000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MASF ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 204.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MASF ALIMENTOS LTDA",
        "tradeName": "MASF ALIMENTOS LTDA",
        "cnpj": "24899145000134",
        "stateRegistration": "0027686490041",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 369",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "PASSA TEMPO",
        "city": "CAMPO BELO",
        "state": "MG",
        "postalCode": "37270000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MASSIMO ZANETTI BEVERAGE BRASIL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 315.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MASSIMO ZANETTI BEVERAGE BRASIL LTDA",
        "tradeName": "MASSIMO ZANETTI BEVERAGE BRASI",
        "cnpj": "72861461000160",
        "stateRegistration": "711001143116",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SARGENTO CASSIANO",
        "addressNumber": "2281",
        "addressComplement": null,
        "district": "CHACARA PRIMAVERA",
        "city": "VARGEM GRANDE DO SUL",
        "state": "SP",
        "postalCode": "13887052",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MC CAFE COMERCIO ATACADISTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 118.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MC CAFE COMERCIO ATACADISTA LTDA",
        "tradeName": "MC COMERCIO DE CAFE",
        "cnpj": "41824227000139",
        "stateRegistration": "0040391510029",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SITIO AREIAS",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "JURUAIA",
        "state": "MG",
        "postalCode": "37805000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MELCAFE INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 447.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MELCAFE INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "MELCAFE INDUSTRIA E COMERCIO",
        "cnpj": "02880391000101",
        "stateRegistration": "101123132",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA GO-060",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SETOR INDUSTRIAL",
        "city": "SAO LUIS DE MONTES BELOS",
        "state": "GO",
        "postalCode": "76058400",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MENDES JR COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 281.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MENDES JR COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "MENDES JR COFFEE",
        "cnpj": "21400825000173",
        "stateRegistration": "5182107460099",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA TRES CORACOES",
        "addressNumber": "111",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37006420",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MENEGHETTI TRANSPORTES E LOGISTICA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 289.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MENEGHETTI TRANSPORTES E LOGISTICA LTDA",
        "tradeName": "METRAN",
        "cnpj": "17088302000166",
        "stateRegistration": "0020756400015",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA THEOCRITO PINHEIRO",
        "addressNumber": "143",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902287",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MERCANTIL COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 393.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MERCANTIL COMERCIO DE CAFE LTDA",
        "tradeName": "MERCANTIL COMERCIO DE CAFE",
        "cnpj": "31533043000166",
        "stateRegistration": "0032778930019",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA AMETISTA",
        "addressNumber": "153",
        "addressComplement": null,
        "district": "ALVORADA",
        "city": "BOA ESPERANCA",
        "state": "MG",
        "postalCode": "37170000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MINAS COFFEE ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 86.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MINAS COFFEE ALIMENTOS LTDA",
        "tradeName": "MINAS COFFEE ALIMENTOS",
        "cnpj": "31415679000103",
        "stateRegistration": "0032684710074",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ARGENTINA",
        "addressNumber": "543",
        "addressComplement": null,
        "district": "DO TREVO",
        "city": "MONTE CARMELO",
        "state": "MG",
        "postalCode": "38500000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MINAS COFFEE LOGISTICA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 205.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MINAS COFFEE LOGISTICA LTDA",
        "tradeName": "MINAS COFFEE LOGISTICA LTDA",
        "cnpj": "59865427000103",
        "stateRegistration": "0051430910020",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DONA VERISSIMA",
        "addressNumber": "591",
        "addressComplement": null,
        "district": "ALTO DA BOA VISTA",
        "city": "MONTE CARMELO",
        "state": "MG",
        "postalCode": "38500000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MINASFE COM. IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 10.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MINASFE COM. IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "MINASFE COM. IMPORTACAO E EXPORTACAO LTDA",
        "cnpj": "15842006000183",
        "stateRegistration": "0019891560040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BARAO DO RIO BRANCO",
        "addressNumber": "237",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902030",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MOINHO COMERCIO ATACADISTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 73.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MOINHO COMERCIO ATACADISTA LTDA",
        "tradeName": "MOINHO COMERCIO ATACADISTA LTDA",
        "cnpj": "57528990000233",
        "stateRegistration": "0050509850065",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV VEREADOR ALFREDO CAMPOLONGO",
        "addressNumber": "1140",
        "addressComplement": null,
        "district": "RESIDENCIAL SANTA TEREZA",
        "city": "SAO SEBASTIAO DO PARAISO",
        "state": "MG",
        "postalCode": "37982324",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MOINHO PETINHO INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 431.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MOINHO PETINHO INDUSTRIA E COMERCIO LTDA",
        "tradeName": "MOINHO PETINHO INDUSTRIA E COMERCIO LTDA",
        "cnpj": "10808491000406",
        "stateRegistration": "0048481920070",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA OTTONI FERREIRA BARBOSA",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "RESIDENCIAL FLORESTA",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37130350",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MOINHO PETINHO INDUSTRIA E COMERCIO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 432.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 36.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MOINHO PETINHO INDUSTRIA E COMERCIO LTDA",
        "tradeName": "CAFE PETINHO",
        "cnpj": "10808491000155",
        "stateRegistration": "000044644",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA VINTE E UM DE ABRIL",
        "addressNumber": "968",
        "addressComplement": null,
        "district": "AFOGADOS",
        "city": "RECIFE",
        "state": "PE",
        "postalCode": "50820000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MONTE VERDE ARMAZENS GERAIS DE CABO VERDE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 174.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MONTE VERDE ARMAZENS GERAIS DE CABO VERDE LTDA",
        "tradeName": "MONTE VERDE ARMAZENS GERAIS",
        "cnpj": "86476694000153",
        "stateRegistration": "0958854870050",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SEBASTIAO INACIO DA SILVA",
        "addressNumber": "10",
        "addressComplement": null,
        "district": "SANTA EDWIRGES",
        "city": "CABO VERDE",
        "state": "MG",
        "postalCode": "37880000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MPS DISTRIBUIDORA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 95.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MPS DISTRIBUIDORA LTDA",
        "tradeName": "MPS DISTRIBUIDORA LTDA",
        "cnpj": "53029830000108",
        "stateRegistration": "262652978",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA 31 DE MARCO",
        "addressNumber": "79",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SAO JOAO BATISTA",
        "state": "SC",
        "postalCode": "88240000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MUNIZ COMERCIO DE CEREAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 261.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MUNIZ COMERCIO DE CEREAIS LTDA",
        "tradeName": "MUNIZ COMERCIO DE CEREAIS LTDA",
        "cnpj": "62609973000180",
        "stateRegistration": "52984130014",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "OTELINA ROSA DE JESUS",
        "addressNumber": "88",
        "addressComplement": null,
        "district": "SAO DIOGO",
        "city": "TEOFILO OTONI",
        "state": "MG",
        "postalCode": "39803022",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "MUNIZ COMERCIO DE GRAOS LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 38.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "MUNIZ COMERCIO DE GRAOS LTDA",
        "tradeName": "MUNIZ COMERCIO DE GRAOS",
        "cnpj": "67994763000176",
        "stateRegistration": "0085063622",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R JOSE MARTINS",
        "addressNumber": "484",
        "addressComplement": null,
        "district": "SAO VICENTE DE PAULO",
        "city": "MUNIZ FREIRE",
        "state": "ES",
        "postalCode": "29380000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NACIONAL INTER AGRICOLA LTDA",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 16. Documento exibido no relatorio: 29.971.331-31 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 15.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NACIONAL INTER AGRICOLA LTDA",
        "tradeName": "NACIONAL INTER AGRICOLA LTDA",
        "cnpj": "29971331000231",
        "stateRegistration": "084258055",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO BOA FE",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "AREA RURAL DE COLATINA",
        "city": "COLATINA",
        "state": "ES",
        "postalCode": "29714899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      },
      {
        "legalName": "NACIONAL INTER AGRICOLA LTDA",
        "tradeName": "NACIONAL INTER AGRICOLA LTDA",
        "cnpj": "29971331000150",
        "stateRegistration": "084256907",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BRASIL",
        "addressNumber": "1817",
        "addressComplement": null,
        "district": "MARIA DAS GRACAS",
        "city": "COLATINA",
        "state": "ES",
        "postalCode": "29705100",
        "isPrimary": false,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NAYME EXPORTADORA DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 235.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NAYME EXPORTADORA DE CAFE LTDA",
        "tradeName": "NAYME EXPORTADORA DE CAFE",
        "cnpj": "27404965000104",
        "stateRegistration": "0029387180026",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BARAO DO RIO BRANCO",
        "addressNumber": "90",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902030",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NICCHIO CAFE S/A EXPORTACAO E IMPORTACAO",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 247.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NICCHIO CAFE S/A EXPORTACAO E IMPORTACAO",
        "tradeName": "NICCHIO CAFE S/A EXPORTACAO E IMPORTACAO",
        "cnpj": "28127579001068",
        "stateRegistration": "3949889760270",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SUELY DAMASCENO",
        "addressNumber": "31",
        "addressComplement": null,
        "district": "CIDADE JARDIM",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NOSSO SABOR ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 219.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NOSSO SABOR ALIMENTOS LTDA",
        "tradeName": "NOSSO SABOR ALIMENTOS LTDA",
        "cnpj": "05311639000101",
        "stateRegistration": "4312051900012",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA URUGUAI",
        "addressNumber": "651",
        "addressComplement": null,
        "district": "DO TREVO",
        "city": "MONTE CARMELO",
        "state": "MG",
        "postalCode": "38500000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NOVA AMERICA ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 300.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NOVA AMERICA ARMAZENS GERAIS LTDA",
        "tradeName": "NOVA AMERICA ARMAZENS GERAIS LTDA",
        "cnpj": "00426485000180",
        "stateRegistration": "6479182740018",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA Rua Jose Mambrini",
        "addressNumber": "605",
        "addressComplement": null,
        "district": "Vila Helena I",
        "city": "SAO SEBASTIAO DO PARAISO",
        "state": "MG",
        "postalCode": "37952022",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NOVA ERA COMERCIAL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 70.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NOVA ERA COMERCIAL LTDA",
        "tradeName": "NOVA ERA COMERCIAL LTDA",
        "cnpj": "20897118000171",
        "stateRegistration": "0024172310060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA GUAPE/ILICINIA",
        "addressNumber": "845",
        "addressComplement": null,
        "district": "ALTO SUMARE",
        "city": "GUAPE",
        "state": "MG",
        "postalCode": "37177000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NOVA SAFRA COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 93.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NOVA SAFRA COMERCIO DE CAFE LTDA",
        "tradeName": "NOVA SAFRA",
        "cnpj": "15320232000102",
        "stateRegistration": "0019419090035",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 116",
        "addressNumber": "0",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SANTA BARBARA DO LESTE",
        "state": "MG",
        "postalCode": "35328000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "NPRO AGRO AGRONEGOCIOS ATACADISTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 391.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "NPRO AGRO AGRONEGOCIOS ATACADISTA LTDA",
        "tradeName": "NPRO AGRO",
        "cnpj": "63613331000117",
        "stateRegistration": "455422675113",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA NUNES PEDROSA",
        "addressNumber": "460",
        "addressComplement": null,
        "district": "LOTE",
        "city": "MOGI GUACU",
        "state": "SP",
        "postalCode": "13840103",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "O. BIANCHI INDUSTRIA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 166.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "O. BIANCHI INDUSTRIA LTDA",
        "tradeName": "CAFE SANTOS REIS",
        "cnpj": "09171797000164",
        "stateRegistration": "00133465500",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA UM",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "SAO JOSE DOS QUATRO MARCOS",
        "state": "MT",
        "postalCode": "78285000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ODEBRECHT COMERCIO E INDUSTRIA DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 172.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ODEBRECHT COMERCIO E INDUSTRIA DE CAFE LTDA",
        "tradeName": "ODEBRECHT COMERCIO E INDUSTRIA DE CAFE LTDA",
        "cnpj": "78597150001193",
        "stateRegistration": "7071166730019",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA WASHINGTON RIBEIRO",
        "addressNumber": "155",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL MIGUEL DE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37072030",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ODEBRECHT COMERCIO E INDUSTRIA DE CAFE LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 22.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ODEBRECHT COMERCIO E INDUSTRIA DE CAFE LTDA",
        "tradeName": "ODEBRECHT COMERCIO E INDUSTRIA DE CAFE LTDA",
        "cnpj": "78597150002084",
        "stateRegistration": "083651594",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA CEREJEIRA",
        "addressNumber": "280",
        "addressComplement": null,
        "district": "MOVELAR",
        "city": "LINHARES",
        "state": "ES",
        "postalCode": "29906015",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "OLAM ARMAZENS GERAIS LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 392.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "OLAM ARMAZENS GERAIS LTDA.",
        "tradeName": "OLAM ARMAZENS GERAIS LTDA.",
        "cnpj": "08472141000380",
        "stateRegistration": "0010330150162",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA MG 111, KM 104,9",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "DIVINEIA",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "OLC COMERCIO ATACADISTA E VAREJISTA DE MERCADORIAS EM GERAL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 42.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "OLC COMERCIO ATACADISTA E VAREJISTA DE MERCADORIAS EM GERAL LTDA",
        "tradeName": "CAFE DIARIO/CAFE SAO CRISTOVAO",
        "cnpj": "26482639000144",
        "stateRegistration": "155422731",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "PASSAGEM IPACARAI",
        "addressNumber": "21B",
        "addressComplement": null,
        "district": "AGUAS LINDAS",
        "city": "ANANINDEUA",
        "state": "PA",
        "postalCode": "67118055",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ORIGENS TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 464.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ORIGENS TRANSPORTES LTDA",
        "tradeName": "ORIGENS TRANSPORTES",
        "cnpj": "62607628000107",
        "stateRegistration": "0052982850036",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA GERALDO PEREIRA",
        "addressNumber": "240",
        "addressComplement": null,
        "district": "POUSO ALEGRE",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36904079",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "OURO MINAS ARMAZENS GERAIS E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 163.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "OURO MINAS ARMAZENS GERAIS E COMERCIO DE CAFE LTDA",
        "tradeName": "OURO MINAS ARMAZENS GERAIS E COMERCIO DE CAFE LTDA",
        "cnpj": "14607286000263",
        "stateRegistration": "0018713680145",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PROJETADA",
        "addressNumber": "100",
        "addressComplement": null,
        "district": "SANTANA",
        "city": "TRES PONTAS",
        "state": "MG",
        "postalCode": "37190000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "OURO VERDE COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 276.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "OURO VERDE COMERCIO DE CAFE LTDA",
        "tradeName": "OURO VERDE COMERCIO DE CAFE",
        "cnpj": "11729114000193",
        "stateRegistration": "0020921700083",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ESTRADA MUNICIPAL CTP 050 KM 01",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "AREA RURAL DE TRES PONTAS",
        "city": "TRES PONTAS",
        "state": "MG",
        "postalCode": "37192899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PAIVA COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 372.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PAIVA COMERCIO DE CAFE LTDA",
        "tradeName": "PAIVA COMERCIO DE CAFE LTDA",
        "cnpj": "63587722000104",
        "stateRegistration": "0053532330059",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "Corrego do Mono",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "Sao Joao do Jacutinga",
        "city": "CARATINGA",
        "state": "MG",
        "postalCode": "35322000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PAIVA DAMASCENA COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 317.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PAIVA DAMASCENA COMERCIO DE CAFE LTDA",
        "tradeName": "PAIVA DAMASCENA COMERCIO DE CAFE LTDA",
        "cnpj": "51293393000100",
        "stateRegistration": "0046564680023",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SITIO BOA VISTA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "FLORESTA",
        "city": "HELIODORA",
        "state": "MG",
        "postalCode": "37484000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PASSARO ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 304.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PASSARO ARMAZENS GERAIS LTDA",
        "tradeName": "PASSARO ARMAZENS GERAIS LTDA",
        "cnpj": "32689883000185",
        "stateRegistration": "0033732660036",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 491",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37002970",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PATRICK PAPARIDIS BRANCHER ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 250.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PATRICK PAPARIDIS BRANCHER ARMAZENS GERAIS LTDA",
        "tradeName": "ITAGUACU ARMAZENS GERAIS",
        "cnpj": "05095016000149",
        "stateRegistration": "3901765920022",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA RICARDO ANONNI FILHO",
        "addressNumber": "1625",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "MACHADO",
        "state": "MG",
        "postalCode": "37750000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PERCOFFE COMERCIO PADRONIZACAO E REBENEFICIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 117.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PERCOFFE COMERCIO PADRONIZACAO E REBENEFICIO DE CAFE LTDA",
        "tradeName": "PERCAFE PADRONIZACAO E REBENEF",
        "cnpj": "29025943000150",
        "stateRegistration": "0030745920047",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA PERCIO PERFEITO",
        "addressNumber": "270",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38446394",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PHT'S TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 24.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 8.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PHT'S TRANSPORTES LTDA",
        "tradeName": "PHT TRANSPORTES E LOGISTICA",
        "cnpj": "53494609000120",
        "stateRegistration": "0048374680040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUCIANA RIBEIRO PINHEIRO",
        "addressNumber": "01",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902281",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PORTO VERDE COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 444.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PORTO VERDE COMERCIO DE CAFE LTDA",
        "tradeName": "PORTO VERDE COMERCIO DE CAFE",
        "cnpj": "30320679000167",
        "stateRegistration": "31815450029",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DAS ROSAS",
        "addressNumber": "223",
        "addressComplement": null,
        "district": "CIDADE JARDIM",
        "city": "TRES CORACOES",
        "state": "MG",
        "postalCode": "37411154",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PRATA DOS SANTOS IND E COM LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 71.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 23.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PRATA DOS SANTOS IND E COM LTDA",
        "tradeName": "CAFE DO PRODUTOR",
        "cnpj": "23138639000133",
        "stateRegistration": "7015501900050",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ODAIR RIBEIRO SANCHEZ",
        "addressNumber": "75",
        "addressComplement": null,
        "district": "COSTA TELLES II",
        "city": "UBERABA",
        "state": "MG",
        "postalCode": "38036360",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PRIMAVERA COFFEE ROBUSTA IMPORTACAO & EXPORTACAO LTDA",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 7. Documento exibido no relatorio: 12.826.691-47 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 7.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PRIMAVERA COFFEE ROBUSTA IMPORTACAO & EXPORTACAO LTDA",
        "tradeName": "PRIMAVERA COFFEE ROBUSTA",
        "cnpj": "12826691000247",
        "stateRegistration": "083496971",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO PRIMAVERA",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "RIO BANANAL",
        "state": "ES",
        "postalCode": "29920000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PRIME COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 483.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PRIME COFFEE COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "PRIME COFFEE COMERCIO E EXPORT",
        "cnpj": "38136546000228",
        "stateRegistration": "0055356760060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "R CAP TEOFILO DIAS BRANCO",
        "addressNumber": "175",
        "addressComplement": null,
        "district": "JARDIM SAO FRANCISCO",
        "city": "MONTE SANTO DE MINAS",
        "state": "MG",
        "postalCode": "37968000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PRIME COMERCIAL DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 162.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PRIME COMERCIAL DE CAFE LTDA",
        "tradeName": "PRIME COMERCIAL DE CAFE LTDA",
        "cnpj": "29970293000111",
        "stateRegistration": "0031537180096",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA LYDIA PUNTEL DE MORAES",
        "addressNumber": "381",
        "addressComplement": null,
        "district": "POLO INDUSTRIAL DE GUAXUPE",
        "city": "GUAXUPE",
        "state": "MG",
        "postalCode": "37834840",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PRIME EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 268.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PRIME EXPORTACAO DE CAFE LTDA",
        "tradeName": "PRIME CORRETORA",
        "cnpj": "33628902000126",
        "stateRegistration": "537066835115",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA SAO SEBASTIAO",
        "addressNumber": "483",
        "addressComplement": null,
        "district": "JARDIM ANA CAROLINA",
        "city": "PIRAJU",
        "state": "SP",
        "postalCode": "18800750",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "PRIMOS CAFE COMERCIO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 480.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "PRIMOS CAFE COMERCIO E EXPORTACAO LTDA",
        "tradeName": "PRIMOS CAFE",
        "cnpj": "65516844000135",
        "stateRegistration": "0054610680041",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA FARIA PEREIRA",
        "addressNumber": "558",
        "addressComplement": null,
        "district": "NACOES",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38745096",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "QUATRO IRMAOS COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 421.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "QUATRO IRMAOS COMERCIO DE CAFE LTDA",
        "tradeName": "QUATRO IRMAOS COMERCIO DE CAFE",
        "cnpj": "23819797000159",
        "stateRegistration": "0026733150069",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "EST TRES PONTAS AO PONTALETE,KM 04",
        "addressNumber": "00000",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "TRES PONTAS",
        "state": "MG",
        "postalCode": "37190000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "R & V TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 10.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "R & V TRANSPORTES LTDA",
        "tradeName": "RV TRANSPORTES",
        "cnpj": "13724157000101",
        "stateRegistration": "082801924",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA RONALD BERGER",
        "addressNumber": "35",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SANTA MARIA DE JETIBA",
        "state": "ES",
        "postalCode": "29645000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "R R COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 394.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "R R COMERCIO DE CAFE LTDA",
        "tradeName": "R R COMERCIO DE CAFE",
        "cnpj": "14592427000130",
        "stateRegistration": "0018697190045",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA NOVA RESENDE A BOM JESUS DA PENHA KM 0,8",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "SAO JOAO",
        "city": "NOVA RESENDE",
        "state": "MG",
        "postalCode": "37860000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "R.N ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 411.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "R.N ALIMENTOS LTDA",
        "tradeName": "R.N ALIMENTOS LTDA",
        "cnpj": "41193487000153",
        "stateRegistration": "0039969950045",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA CORONEL OSORIO, QUADRA 12",
        "addressNumber": "665",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "ITUETA",
        "state": "MG",
        "postalCode": "35220970",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "RAIZ FORTE COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 27.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "RAIZ FORTE COMERCIO DE CAFE LTDA",
        "tradeName": "RAIZ FORTE",
        "cnpj": "26582322000180",
        "stateRegistration": "0032748500040",
        "municipalRegistration": null,
        "email": "controler@caferaizforte.com.br",
        "phone": null,
        "addressLine": "AVENIDA BARAO DO RIO BRANCO",
        "addressNumber": "217",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902030",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "RANCHEIRO S.A.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 209.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "RANCHEIRO S.A.",
        "tradeName": "RANCHEIRO",
        "cnpj": "02924249000119",
        "stateRegistration": "101485891",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA VP 1D",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "DISTRITO AGROINDUSTRIAL DE ANA",
        "city": "ANAPOLIS",
        "state": "GO",
        "postalCode": "75132035",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "REAL COFFEE INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 477.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "REAL COFFEE INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "REAL COFFEE",
        "cnpj": "07414421000108",
        "stateRegistration": "4813642670037",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JACINTO BARBOSA",
        "addressNumber": "247",
        "addressComplement": null,
        "district": "SAO FRANCISCO",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38742038",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "REALIZA INDUSTRIA DE TORREFACAO E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 445.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "REALIZA INDUSTRIA DE TORREFACAO E COMERCIO DE CAFE LTDA",
        "tradeName": "REALIZA TORREFACAO",
        "cnpj": "31343154000100",
        "stateRegistration": "0032627270087",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BONIFACIO ANDRADA",
        "addressNumber": "1080",
        "addressComplement": null,
        "district": "PARQUE SAO LUCAS",
        "city": "ELOI MENDES",
        "state": "MG",
        "postalCode": "37110000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "REBENEFICIO DE CAFE ABREU & BARBOSA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 221.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "REBENEFICIO DE CAFE ABREU & BARBOSA LTDA",
        "tradeName": "REBENEFICIO DE CAFE ABREU & BA",
        "cnpj": "57144243000110",
        "stateRegistration": "0049849780037",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUCIANA RIBEIRO PINHEIRO",
        "addressNumber": "554",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902281",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "RENASCER EXPORTACAO E IMPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 88.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "RENASCER EXPORTACAO E IMPORTACAO LTDA",
        "tradeName": "RENASCER EXPORTACAO E IMPORTACAO LTDA",
        "cnpj": "03714554000149",
        "stateRegistration": "3941094570066",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO CORREGO DO COQUEIRO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "MATINHA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36900000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "RESPLENDOR COMERCIO DE GRAOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 311.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "RESPLENDOR COMERCIO DE GRAOS LTDA",
        "tradeName": "RESPLENDOR GRAOS",
        "cnpj": "62897318000174",
        "stateRegistration": "0053147090027",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 259",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "AREA RURAL",
        "city": "RESPLENDOR",
        "state": "MG",
        "postalCode": "35230000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "REVOLUCAO TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 187.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "REVOLUCAO TRANSPORTES LTDA",
        "tradeName": "REVOLUCAO TRANSPORTES LTDA",
        "cnpj": "10744425000169",
        "stateRegistration": "0023334850099",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA NADIA MARIA RAMOS DE OLIVEIRA",
        "addressNumber": "01",
        "addressComplement": null,
        "district": "PONTE DA ALDEIA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36906441",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "REVOLUCAO TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 278.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "REVOLUCAO TRANSPORTES LTDA",
        "tradeName": "REVOLUCAO TRANSPORTES LTDA",
        "cnpj": "10744425000592",
        "stateRegistration": "0023334850170",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "ALAMEDA DO CAFE",
        "addressNumber": "195",
        "addressComplement": null,
        "district": "JARDIM ANDERE",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026400",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "REVOLUCAO TRANSPORTES LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 210.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "REVOLUCAO TRANSPORTES LTDA.",
        "tradeName": "REVOLUCAO TRANSPORTES LTDA.",
        "cnpj": "10744425000240",
        "stateRegistration": "083621008",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JOSE ANTONIO LOFEGO",
        "addressNumber": "46",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "IUNA",
        "state": "ES",
        "postalCode": "29390000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "RIO PARDO LOG LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 340.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "RIO PARDO LOG LTDA",
        "tradeName": "RIO PARDO LOG LTDA",
        "cnpj": "52315458000133",
        "stateRegistration": "612174306114",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA QUINTINO BOCAIUVA",
        "addressNumber": "473",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SANTA CRUZ DO RIO PARDO",
        "state": "SP",
        "postalCode": "18900039",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "S &  M COFFEE COMERCIO E SERVICOS LTDA",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 37. Documento exibido no relatorio: 37.501.601-98 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 37.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "S &  M COFFEE COMERCIO E SERVICOS LTDA",
        "tradeName": "S & M COFFEE",
        "cnpj": "37501601000198",
        "stateRegistration": "083664041",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "COMUNIDADE DE SAO ROQUE",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "VENDA NOVA DO IMIGRANTE",
        "state": "ES",
        "postalCode": "29375000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "S & H EXPORTADORA DE ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 17.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "S & H EXPORTADORA DE ALIMENTOS LTDA",
        "tradeName": "SALUTE",
        "cnpj": "44305507000129",
        "stateRegistration": "133526926114",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ROUXINOL",
        "addressNumber": "60",
        "addressComplement": null,
        "district": "INDIANOPOLIS",
        "city": "SAO PAULO",
        "state": "SP",
        "postalCode": "04516000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "S B DE OLIVEIRA COMERCIO DE CAFE LTDA",
    "notes": "Situacao cadastral: ATIVA\nImportado/atualizado pela base Vulpe em 23/07/2026. Codigo Vulpe: 44.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "S B DE OLIVEIRA COMERCIO DE CAFE LTDA",
        "tradeName": "S B DE OLIVEIRA COMERCIO DE CAFE LTDA",
        "cnpj": "12454636000192",
        "stateRegistration": "0024322560040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA PALMEIRAS",
        "addressNumber": "100",
        "addressComplement": null,
        "district": "MATINHA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902188",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "S R CAFE LTDA",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 11. Documento exibido no relatorio: 32.530.364-70 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 11.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "S R CAFE LTDA",
        "tradeName": "S R CAFE LTDA",
        "cnpj": "32530364000170",
        "stateRegistration": "083535632",
        "municipalRegistration": null,
        "email": "financeirosrcafe@gmail.com",
        "phone": null,
        "addressLine": "RUA MARCIO TONINI",
        "addressNumber": "136",
        "addressComplement": null,
        "district": "SANTA LUZIA",
        "city": "SAO ROQUE DO CANAA",
        "state": "ES",
        "postalCode": "29665000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SABANA TRADING COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 364.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SABANA TRADING COMERCIO DE CAFE LTDA",
        "tradeName": "SABANA TRADING",
        "cnpj": "32611305000126",
        "stateRegistration": "0033670690093",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AREA RURAL",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "AREA RURAL DE PATROCINIO",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38748899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SABIA ALIMENTOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 389.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SABIA ALIMENTOS LTDA",
        "tradeName": "SABIA ALIMENTOS LTDA",
        "cnpj": "39584882000115",
        "stateRegistration": "202709620",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BANDEIRANTES",
        "addressNumber": "1479",
        "addressComplement": null,
        "district": "JD PETROPOLIS",
        "city": "GOIANIA",
        "state": "GO",
        "postalCode": "74460190",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SAFIRA COMERCIO ATACADISTA DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 207.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SAFIRA COMERCIO ATACADISTA DE CAFE LTDA",
        "tradeName": "SAFIRA COMERCIO DE CAFE",
        "cnpj": "54943884000147",
        "stateRegistration": "0048817360090",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CHACARA AMORAS",
        "addressNumber": "CH 111",
        "addressComplement": null,
        "district": "AREA RURAL",
        "city": "CAMPOS GERAIS",
        "state": "MG",
        "postalCode": "37160000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SANTOS SILVA TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 142.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SANTOS SILVA TRANSPORTES LTDA",
        "tradeName": "P F TRANSPORTES",
        "cnpj": "42836118000102",
        "stateRegistration": "0041020710047",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JACYR DA SILVA FREDERICO",
        "addressNumber": "254",
        "addressComplement": null,
        "district": "SITIO DOS PERIQUITOS",
        "city": "COIMBRA",
        "state": "MG",
        "postalCode": "36550000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SAO PEDRO COMERCIO E AGRICOLA LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 452.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SAO PEDRO COMERCIO E AGRICOLA LTDA.",
        "tradeName": "SAO PEDRO COMERCIO E AGRICOLA",
        "cnpj": "40244822000132",
        "stateRegistration": "0039299330077",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FAZ SAO PEDRO",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "PIOS",
        "city": "ANDRADAS",
        "state": "MG",
        "postalCode": "37795000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SARAH VILELA DA MATA MIRANDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 180.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SARAH VILELA DA MATA MIRANDA",
        "tradeName": "D'MATA SOLUCOES AGRONOMICAS",
        "cnpj": "41682627000157",
        "stateRegistration": "0040289360099",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA BARAO DA BOA ESPERANCA",
        "addressNumber": "1866",
        "addressComplement": null,
        "district": "AZARIAS DA SILVA CAMPOS",
        "city": "TRES PONTAS",
        "state": "MG",
        "postalCode": "37190001",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SAV ARMAZENS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 442.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SAV ARMAZENS GERAIS LTDA",
        "tradeName": "MINAS CAFE ARMAZENS GERAIS",
        "cnpj": "44488259000107",
        "stateRegistration": "0042149840030",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA GENERAL ASTOLFO FERREIRA MENDES",
        "addressNumber": "1840",
        "addressComplement": null,
        "district": "MORADA DO SOL",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38744608",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SELECTA CAFES DO BRASIL LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 214.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SELECTA CAFES DO BRASIL LTDA",
        "tradeName": "SELECTA CAFES DO BRASIL",
        "cnpj": "37837362000141",
        "stateRegistration": "0037897240096",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA GABRIELA REZENDE PAIVA",
        "addressNumber": "350",
        "addressComplement": null,
        "district": "SANTA LUIZA",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026650",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SERAFINI COFFEE COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 196.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SERAFINI COFFEE COMERCIO DE CAFE LTDA",
        "tradeName": "SERAFINI COFFEE COMERCIO DE CA",
        "cnpj": "35246489000160",
        "stateRegistration": "0035750490092",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "SIT SAO LUIZ",
        "addressNumber": "000",
        "addressComplement": null,
        "district": "CAFUNDO",
        "city": "BUENO BRANDAO",
        "state": "MG",
        "postalCode": "37578000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SERRA GERAIS TORREFACAO E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 386.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SERRA GERAIS TORREFACAO E COMERCIO DE CAFE LTDA",
        "tradeName": "SERRA GERAIS",
        "cnpj": "37711733000144",
        "stateRegistration": "0037793870077",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "FAZENDA SERRADOR",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "SENADOR FIRMINO",
        "state": "MG",
        "postalCode": "36540000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SILVA COMERCIO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 32.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SILVA COMERCIO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "SILVA COMERCIO E EXPORTACAO DE CAFE LTDA",
        "cnpj": "21446325000172",
        "stateRegistration": "0024696260046",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA FARIA PEREIRA",
        "addressNumber": "814",
        "addressComplement": null,
        "district": "NACOES",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38745096",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SJB COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 320.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SJB COMERCIO DE CAFE LTDA",
        "tradeName": "SJB COMERCIO DE CAFE LTDA",
        "cnpj": "25219933000103",
        "stateRegistration": "0027967440099",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV ROZENDO GONCALVES DE REZENDE",
        "addressNumber": "220",
        "addressComplement": null,
        "district": "BARRO BRANCO",
        "city": "NOVA RESENDE",
        "state": "MG",
        "postalCode": "37860000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SOARES COMERCIO DE CEREAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 354.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SOARES COMERCIO DE CEREAIS LTDA",
        "tradeName": "SOARES COMERCIO DE CEREAIS",
        "cnpj": "63117845000181",
        "stateRegistration": "0053269070080",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA AVELINO DE ANDRADE PINHEIRO",
        "addressNumber": "281",
        "addressComplement": null,
        "district": "VILA JARDIM NOSSA SENHORA DE F",
        "city": "SAO JOAO DEL REI",
        "state": "MG",
        "postalCode": "36305340",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SOARES E SILVA AGENCIAMENTO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 439.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 21.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SOARES E SILVA AGENCIAMENTO LTDA",
        "tradeName": "SOARES E SILVA AGENCIAMENTO",
        "cnpj": "51832362000180",
        "stateRegistration": "0046917230073",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SILAS PACHECO",
        "addressNumber": "712",
        "addressComplement": null,
        "district": "COLINA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36900380",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "ST BRASIL LOG LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 114.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "ST BRASIL LOG LTDA",
        "tradeName": "STEFENONI TRANSPORTES",
        "cnpj": "21711790000193",
        "stateRegistration": "083081690",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AREA RURAL",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "AREA RURAL DE COLATINA",
        "city": "COLATINA",
        "state": "ES",
        "postalCode": "29714899",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "STEFENONI INTERAGRICOLA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 8.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "STEFENONI INTERAGRICOLA LTDA",
        "tradeName": "STEFENONI INTERAGRICOLA LTDA",
        "cnpj": "21475922000559",
        "stateRegistration": "0033026330183",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA ANTONIO RUST",
        "addressNumber": "1026",
        "addressComplement": null,
        "district": "ROQUE",
        "city": "MANHUMIRIM",
        "state": "MG",
        "postalCode": "36970000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "STEFENONI INTERAGRICOLA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 19.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "STEFENONI INTERAGRICOLA LTDA",
        "tradeName": "STEFENONI INTERAGRICOLA LTDA",
        "cnpj": "21475922000478",
        "stateRegistration": "0033026330000",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV PORTO ALEGRE",
        "addressNumber": "1115",
        "addressComplement": null,
        "district": "MILENIUM",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38446218",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "SUL DE MINAS COMERCIO EXPORTACAO E IMPORTACAO LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 20.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "SUL DE MINAS COMERCIO EXPORTACAO E IMPORTACAO LTDA",
        "tradeName": "SUL DE MINAS COMERCIO EXPORTAC",
        "cnpj": "48397666000151",
        "stateRegistration": "084594640",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA ANISIO FERNANDES COELHO",
        "addressNumber": "1301",
        "addressComplement": null,
        "district": "JARDIM DA PENHA",
        "city": "VITORIA",
        "state": "ES",
        "postalCode": "29060670",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "T R SILVA TRANSPORTES LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 123.\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 9.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "T R SILVA TRANSPORTES LTDA",
        "tradeName": "T R SILVA TRANSPORTES LTDA",
        "cnpj": "30542556000170",
        "stateRegistration": "0031998320049",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA WADI ASSAD",
        "addressNumber": "26",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902305",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TALLES NIQUISON PEREIRA COSTA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 21.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TALLES NIQUISON PEREIRA COSTA LTDA",
        "tradeName": "COMISSARIA DE CAFE MUNDO NOVO",
        "cnpj": "40770262000150",
        "stateRegistration": "0039669170044",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA BARAO DA BOA ESPERANCA",
        "addressNumber": "1845",
        "addressComplement": null,
        "district": "AZARIAS DA SILVA CAMPOS",
        "city": "TRES PONTAS",
        "state": "MG",
        "postalCode": "37190000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TEMPERA ARMAZENS GERAIS, COMERCIO ATACADISTA E EXPORTACAO",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 428.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TEMPERA ARMAZENS GERAIS, COMERCIO ATACADISTA E EXPORTACAO",
        "tradeName": "TEMPERA ARMAZENS GERAIS, COMERCIO ATACADISTA E EXPORTACAO",
        "cnpj": "12911661000158",
        "stateRegistration": "0016969570096",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ALCINO JOSE DE ARAUJO",
        "addressNumber": "580",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SAO FRANCISCO DE PAULA",
        "state": "MG",
        "postalCode": "35543000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TERRAFERTIL COMERCIO DE PRODUTOS AGROPECUARIOS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 218.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TERRAFERTIL COMERCIO DE PRODUTOS AGROPECUARIOS LTDA",
        "tradeName": "TERRAFERTIL COMERCIO DE PRODUT",
        "cnpj": "05192592000104",
        "stateRegistration": "0141896160008",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ANTONIO GENEROSO",
        "addressNumber": "21",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "ALBERTINA",
        "state": "MG",
        "postalCode": "37596000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TERRANOVA COMERCIO E REBENEFICIAMENTO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 436.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TERRANOVA COMERCIO E REBENEFICIAMENTO DE CAFE LTDA",
        "tradeName": "TERRANOVA COMERCIO E REBENEFICIAMENTO DE CAFE LTDA",
        "cnpj": "33625325000119",
        "stateRegistration": "0034454180040",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CAETANO LEONE",
        "addressNumber": "597",
        "addressComplement": null,
        "district": "JARDIM SANTA INES",
        "city": "MONTE SANTO DE MINAS",
        "state": "MG",
        "postalCode": "37968000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TIZIU COFFEES COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 258.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TIZIU COFFEES COMERCIO DE CAFE LTDA",
        "tradeName": "TIZIU COFFEES",
        "cnpj": "24450406000134",
        "stateRegistration": "530051080113",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA DOS TRABALHADORES",
        "addressNumber": "24",
        "addressComplement": null,
        "district": "JARDIM DAS ROSAS",
        "city": "ESPIRITO SANTO DO PINHAL",
        "state": "SP",
        "postalCode": "13990000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TORREFACAO E MOAGEM DE CAFE LOLI LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 43.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TORREFACAO E MOAGEM DE CAFE LOLI LTDA",
        "tradeName": "CAFE MACALI",
        "cnpj": "02508127000141",
        "stateRegistration": "313053616117",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA ELISEU BERNABE",
        "addressNumber": "S/N*",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "GABRIEL MONTEIRO",
        "state": "SP",
        "postalCode": "16220000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TORREFACAO E MOAGEM DE CAFE RIBEIRAO BONITO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 321.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TORREFACAO E MOAGEM DE CAFE RIBEIRAO BONITO LTDA",
        "tradeName": "TORREFACAO E MOAGEM DE CAFE RIBEIRAO BONITO LTDA",
        "cnpj": "50405547000145",
        "stateRegistration": "577000107116",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "VIA DOMINGOS CARON",
        "addressNumber": "812",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "RIBEIRAO BONITO",
        "state": "SP",
        "postalCode": "13580000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TORREFACAO E MOAGEM DE CAFE UNAI LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 265.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TORREFACAO E MOAGEM DE CAFE UNAI LTDA",
        "tradeName": "TORREFACAO E MOAGEM DE CAFE UNAI LTDA",
        "cnpj": "25839127000120",
        "stateRegistration": "7040759440086",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA RIO PRETO",
        "addressNumber": "327",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "UNAI",
        "state": "MG",
        "postalCode": "38610084",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TORREFACAO MOURA LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 11.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TORREFACAO MOURA LTDA",
        "tradeName": "TORREFACAO MOURA LTDA",
        "cnpj": "21681523000110",
        "stateRegistration": "6514149920006",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA CLEMENTE SANTANA",
        "addressNumber": "1133",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "SAO TOMAS DE AQUINO",
        "state": "MG",
        "postalCode": "37960000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TORREFACAO WINDSOR DE MINAS GERAIS LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 457.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TORREFACAO WINDSOR DE MINAS GERAIS LTDA",
        "tradeName": "CAFE WINDSOR",
        "cnpj": "23117146000117",
        "stateRegistration": "3380287880016",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JACINTO FERREIRA",
        "addressNumber": "121",
        "addressComplement": null,
        "district": "VILA TAVARES",
        "city": "ITAUNA",
        "state": "MG",
        "postalCode": "35680070",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TPJ COMERCIO ATACADISTA DE CAFE IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 179.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TPJ COMERCIO ATACADISTA DE CAFE IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "TPJ CAFE IMPORTACAO E EXPORTAC",
        "cnpj": "09483354000109",
        "stateRegistration": "0010670910082",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA CARANGOLA",
        "addressNumber": "538",
        "addressComplement": null,
        "district": "CENTRO",
        "city": "ESPERA FELIZ",
        "state": "MG",
        "postalCode": "36830000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TPJ COMERCIO ATACADISTA DE CAFE IMPORTACAO E EXPORTACAO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 302.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TPJ COMERCIO ATACADISTA DE CAFE IMPORTACAO E EXPORTACAO LTDA",
        "tradeName": "TPJ CAFE",
        "cnpj": "09483354000613",
        "stateRegistration": "0010670910406",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "CORREGO SAO FELIPE",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "ZONA RURAL",
        "city": "ESPERA FELIZ",
        "state": "MG",
        "postalCode": "36830000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TRANSERV SERVICOS DE TRANSPORTE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 358.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TRANSERV SERVICOS DE TRANSPORTE LTDA",
        "tradeName": "TRANSERV",
        "cnpj": "02350385000223",
        "stateRegistration": "083151583",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR-262",
        "addressNumber": "S/N",
        "addressComplement": null,
        "district": "PRIMAVERA",
        "city": "VIANA",
        "state": "ES",
        "postalCode": "29135160",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TRANSERV SERVICOS DE TRANSPORTE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 427.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TRANSERV SERVICOS DE TRANSPORTE LTDA",
        "tradeName": "TRANSERV",
        "cnpj": "02350385000142",
        "stateRegistration": "3940816460065",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR 262",
        "addressNumber": "27",
        "addressComplement": null,
        "district": "PONTE DA ALDEIA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36900000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TRANSPORTADORA DE CARGAS VASSULER LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 324.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TRANSPORTADORA DE CARGAS VASSULER LTDA.",
        "tradeName": "TRANSPORTADORA DE CARGAS VASSULER LTDA.",
        "cnpj": "17776914000141",
        "stateRegistration": "0021177670020",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA SANTO ANTONIO",
        "addressNumber": "1274",
        "addressComplement": null,
        "district": "QUATITUBA",
        "city": "ITUETA",
        "state": "MG",
        "postalCode": "35222000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TRANSPORTADORA EUROCAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 322.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TRANSPORTADORA EUROCAFE LTDA",
        "tradeName": "TRANSPORTADORA EUROCAFE",
        "cnpj": "24948582000109",
        "stateRegistration": "0027730080060",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JACINTO ALVES PEREIRA",
        "addressNumber": "305",
        "addressComplement": null,
        "district": "SANTA TEREZINHA",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38742090",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "TRUVILLE INDUSTRIA E COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 395.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "TRUVILLE INDUSTRIA E COMERCIO DE CAFE LTDA",
        "tradeName": "CAFE TRUVILLE",
        "cnpj": "19072807000168",
        "stateRegistration": "310526407116",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA IVO RODRIGUES DE FREITAS",
        "addressNumber": "2991",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL ANTONIO DELLA - TORRE",
        "city": "FRANCA",
        "state": "SP",
        "postalCode": "14406079",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "UNI GRAO CAFE COMERCIO IMP E EXP DE CAFE LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 5.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "UNI GRAO CAFE COMERCIO IMP E EXP DE CAFE LTDA",
        "tradeName": "UNI GRAO CAFE COMERCIO IMP E EXP DE CAFE LTDA",
        "cnpj": "15463395000217",
        "stateRegistration": "084432470",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV NOSSA SENHORA DOS NAVEGANTES",
        "addressNumber": "675",
        "addressComplement": null,
        "district": "ENSEADA DO SUA",
        "city": "VITORIA",
        "state": "ES",
        "postalCode": "3205309",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "UNI GRAO CAFE COMERCIO IMPORTACAO E EXPORTACAO DE CAFE LTDA",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 5. Documento exibido no relatorio: 15.463.395-17 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe em 23/07/2026. Codigo Vulpe: 48.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "UNI GRAO CAFE COMERCIO IMPORTACAO E EXPORTACAO DE CAFE LTDA",
        "tradeName": "UNI GRAO CAFE COMERCIO E EXPOR",
        "cnpj": "15463395000136",
        "stateRegistration": "0036302490081",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA LUCIANA RIBEIRO PINHEIRO",
        "addressNumber": "224",
        "addressComplement": null,
        "district": "BOM PASTOR",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902281",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "UNIAGRO LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 34.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "UNIAGRO LTDA",
        "tradeName": "UNIAGRO",
        "cnpj": "23491910000110",
        "stateRegistration": "083135014",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA NOSSA SENHORA DA CONCEICAO",
        "addressNumber": "225",
        "addressComplement": null,
        "district": "PIACU",
        "city": "MUNIZ FREIRE",
        "state": "ES",
        "postalCode": "29380000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "UNION TRADING COMERCIO, IMPORTACAO E EXPORTACAO LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 160.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "UNION TRADING COMERCIO, IMPORTACAO E EXPORTACAO LTDA.",
        "tradeName": "UNION TRADING COMERCIO, IMPORTACAO E EXPORTACAO LTDA.",
        "cnpj": "11881236000362",
        "stateRegistration": "0017346410033",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA DO COMERCIO DE CAFE",
        "addressNumber": "101",
        "addressComplement": null,
        "district": "INDUSTRIAL REINALDO FORESTI",
        "city": "VARGINHA",
        "state": "MG",
        "postalCode": "37026530",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "V&W CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 206.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "V&W CAFE LTDA",
        "tradeName": "C&V COFFEE E ALIMENTOS",
        "cnpj": "43339668000170",
        "stateRegistration": "0041351790064",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA JEFFERSON ROSA ARAUJO",
        "addressNumber": "166",
        "addressComplement": null,
        "district": "MILENIUM",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38447383",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "VASCONCELOS INDUSTRIA, COMERCIO, IMPORTACAO E EXPORTACAO LTDA.",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 267.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "VASCONCELOS INDUSTRIA, COMERCIO, IMPORTACAO E EXPORTACAO LTDA.",
        "tradeName": "ARROZ VASCONCELOS",
        "cnpj": "03647755000170",
        "stateRegistration": "0350658680018",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RODOVIA BR-050",
        "addressNumber": "SN",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ARAGUARI",
        "state": "MG",
        "postalCode": "38446232",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "VASSULER COMERCIO DE ADUBO E CAFE LTDA.",
    "notes": "Importado da lista Villa ES em 23/07/2026. Codigo Vulpe: 35. Documento exibido no relatorio: 12.103.047-40 (print truncado; conferir CNPJ/CPF completo depois).\nImportado/atualizado pela base Vulpe ES em 23/07/2026. Codigo Vulpe: 35.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "VASSULER COMERCIO DE ADUBO E CAFE LTDA.",
        "tradeName": "VASSULER COMERCIO DE ADUBO E CAFE LTDA.",
        "cnpj": "12103047000240",
        "stateRegistration": "084188910",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA SANTA TEREZINHA",
        "addressNumber": "1017",
        "addressComplement": null,
        "district": "SAO JOSE",
        "city": "BAIXO GUANDU",
        "state": "ES",
        "postalCode": "29730000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "VEREDAS CAFE DO CERRADO LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 375.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "VEREDAS CAFE DO CERRADO LTDA",
        "tradeName": "VEREDAS TRADE",
        "cnpj": "37077905000170",
        "stateRegistration": "0037251720086",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA GENERAL ASTOLFO FERREIRA MENDES",
        "addressNumber": "2073",
        "addressComplement": null,
        "district": "SAO JUDAS",
        "city": "PATROCINIO",
        "state": "MG",
        "postalCode": "38743018",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "VIANA COFFEE COMERCIO DE CAFE LTDA - EPP",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 376.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "VIANA COFFEE COMERCIO DE CAFE LTDA - EPP",
        "tradeName": "VIANA COFFEE",
        "cnpj": "20706186000106",
        "stateRegistration": "0023996430043",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AV. DR. LINCOLN WESTIN DA SILVEIRA",
        "addressNumber": "2160",
        "addressComplement": null,
        "district": "ESTACAO",
        "city": "ALFENAS",
        "state": "MG",
        "postalCode": "37130288",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "VIANNA TRADER COFFEE IMPORT EXPORT LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 313.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "VIANNA TRADER COFFEE IMPORT EXPORT LTDA",
        "tradeName": "VIANNA TRADER COFFEE IMPORT EX",
        "cnpj": "03988814000174",
        "stateRegistration": "0020150920083",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA BARAO DO RIO BRANCO",
        "addressNumber": "90",
        "addressComplement": null,
        "district": "BAIXADA",
        "city": "MANHUACU",
        "state": "MG",
        "postalCode": "36902030",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "VILA 40 COMERCIO DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 64.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "VILA 40 COMERCIO DE CAFE LTDA",
        "tradeName": "VILA 40 COMERCIO DE CAFE LTDA",
        "cnpj": "20920233000110",
        "stateRegistration": "0024194120000",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA PONTAL",
        "addressNumber": "40",
        "addressComplement": null,
        "district": "DISTRITO INDUSTRIAL",
        "city": "ELOI MENDES",
        "state": "MG",
        "postalCode": "37110000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "W R COMERCIO E SERVICOS LTDA",
    "notes": "Importado da base Vulpe ES em 23/07/2026. Codigo Vulpe: 25.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "W R COMERCIO E SERVICOS LTDA",
        "tradeName": "W R COMERCIO DE CAFE",
        "cnpj": "57878075000197",
        "stateRegistration": "084821493",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "RUA ERNANI BONACOSSA",
        "addressNumber": "287",
        "addressComplement": null,
        "district": "PARQUE RESIDENCIAL",
        "city": "ALFREDO CHAVES",
        "state": "ES",
        "postalCode": "29240000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  },
  {
    "displayName": "W. A. TORREFACAO E MOAGEM DE CAFE LTDA",
    "notes": "Importado da base Vulpe em 23/07/2026. Codigo Vulpe: 51.",
    "isActive": true,
    "creditLimitCents": null,
    "roles": [
      "BUYER",
      "CLIENT"
    ],
    "legalEntities": [
      {
        "legalName": "W. A. TORREFACAO E MOAGEM DE CAFE LTDA",
        "tradeName": "CAFE NANDA",
        "cnpj": "05064149000158",
        "stateRegistration": "00132089378",
        "municipalRegistration": null,
        "email": null,
        "phone": null,
        "addressLine": "AVENIDA JK",
        "addressNumber": "1279-S",
        "addressComplement": null,
        "district": "SETOR DE SERVICOS",
        "city": "JUINA",
        "state": "MT",
        "postalCode": "78320000",
        "isPrimary": true,
        "isActive": true,
        "isDraft": false
      }
    ],
    "contacts": []
  }
] satisfies ClientMasterDataEntry[];
