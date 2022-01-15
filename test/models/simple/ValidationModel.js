export default {
  fields: {
    id: {
      type: 'uuid',
      rule: {
        type_validation: false,
      },
    },
    name: {
      type: 'varchar',
      rule: {
        required: true,
      },
    },
    age: {
      type: 'int',
      rule: {
        validator: (value) => (parseInt(value, 10) > 0),
        message: (value) => (`Age must be greater than 0. You provided ${value}`),
        type_validation: false,
      },
    },
  },
  key: ['id'],
};
