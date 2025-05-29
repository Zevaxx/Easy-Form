import { Form, FormField, FormFieldGroup } from '../src/form/Form';

// Test nested FormFieldGroup
const nestedForm = new Form({
	user: new FormFieldGroup({
		name: new FormField('John'),
		address: new FormFieldGroup({
			street: new FormField('123 Main St'),
			city: new FormField('New York'),
			coordinates: new FormFieldGroup({
				lat: new FormField(40.7128),
				lng: new FormField(-74.006),
			}),
		}),
	}),
	metadata: new FormField({ created: new Date(), version: 1 }),
});

// Test que paths inválidos den error de tipo
// @ts-expect-error - Path 'user.nonexistent' should not exist
nestedForm.getValueByPath('user.nonexistent');

// @ts-expect-error - Path 'user.address.invalidField' should not exist
nestedForm.getValueByPath('user.address.invalidField');

// @ts-expect-error - Path 'nonexistent' should not exist
nestedForm.getValueByPath('nonexistent');

// @ts-expect-error - Path 'user.address.coordinates.invalid' should not exist
nestedForm.getValueByPath('user.address.coordinates.invalid');

// Test que setValueByPath rechace tipos incorrectos
// @ts-expect-error - string expected, number given
nestedForm.setValueByPath('user.name', 123);

// @ts-expect-error - number expected, string given
nestedForm.setValueByPath('user.address.coordinates.lat', 'invalid');

// @ts-expect-error - object expected, string given
nestedForm.setValueByPath('metadata', 'invalid');

// Test setFieldValue para campos de primer nivel
const simpleForm = new Form({
	name: new FormField('John'),
	age: new FormField(25),
});

// Test que setFieldValue rechace tipos incorrectos
// @ts-expect-error - string expected
simpleForm.setValueByPath('name', 123);

// @ts-expect-error - number expected
simpleForm.setValueByPath('age', 'invalid');

// Test validator types

// Test que validators con tipos incorrectos den error
// @ts-expect-error - validator should accept string, not number
new FormField('test', (value: number) => stringValidator(value.toString()));
