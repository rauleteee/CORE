/* eslint-disable no-invalid-this*/
/* eslint-disable no-undef*/
const path = require("path");
const {log,has_failed,checkFileExists,create_browser,from_env,ROOT,path_assignment, warn_errors, scored, checkFilExists} = require("./testutils");
const fs = require("fs");
const net = require('net');
const spawn = require("child_process").spawn;
const util = require('util');
const exec = util.promisify(require("child_process").exec);

const PATH_ASSIGNMENT = path_assignment("blog");
const URL = `file://${path.resolve(path.join(PATH_ASSIGNMENT.replace("%", "%25"), "cv.html"))}`;
// Should the server log be included in the logs?
const TIMEOUT =  parseInt(from_env("TIMEOUT", 6000));
const TEST_PORT =  parseInt(from_env("TEST_PORT", "3001"));

let browser = create_browser();

var server;


describe("Tests Práctica 7", function() {
    after(function () {
        warn_errors();
    });

    describe("Prechecks", function () {
	      scored(`Comprobando que existe la carpeta de la entrega: ${PATH_ASSIGNMENT}`,
               -1,
               async function () {
                   this.msg_err = `No se encontró la carpeta '${PATH_ASSIGNMENT}'`;
                   (await checkFileExists(PATH_ASSIGNMENT)).should.be.equal(true);
	             });

        scored(`Comprobar que se han añadido plantillas express-partials`, -1, async function () {
            this.msg_ok = 'Se incluye layout.ejs';
            this.msg_err = 'No se ha encontrado views/layout.ejs';
            fs.existsSync(path.join(PATH_ASSIGNMENT, "views", "layout.ejs")).should.be.equal(true);
        });

        scored(`Comprobar que la migración y el seeder para Usuarios existen`, -1, async function () {
            this.msg_ok = 'Se incluye la migración y el seeder';
            this.msg_err = "No se incluye la migración o el seeder";

            let mig = fs.readdirSync(path.join(PATH_ASSIGNMENT, "migrations")).filter(fn => fn.endsWith('-CreateUsersTable.js'));
            this.msg_err = `No se ha encontrado la migración`;

            (mig.length).should.be.equal(1);
            this.msg_err = `La migración no incluye el campo email`;
            log(mig[0]);
            let templ = fs.readFileSync(path.join(PATH_ASSIGNMENT, "migrations", mig[0]));
            /email/.test(templ).should.be.equal(true);


            let seed = fs.readdirSync(path.join(PATH_ASSIGNMENT, "seeders")).filter(fn => fn.endsWith('-FillUsersTable.js'));
            this.msg_err = 'No se ha encontrado el seeder';
            (seed.length).should.be.equal(1);
            this.msg_err = `El seed no incluye el campo email correctamente`;
            templ = fs.readFileSync(path.join(PATH_ASSIGNMENT, "seeders", seed[0]));
            /email/.test(templ).should.be.equal(true);
            /admin\@core.example/.test(templ).should.be.equal(true);
            /pepe\@core.example/.test(templ).should.be.equal(true);
            // We could use a regex here to check the date
        });

        scored(`Comprobar que los controladores existen`, -1, async function () {
            this.msg_ok = 'Se incluyen los controladores de usuarios y sesiones';
            this.msg_err = "No se incluye el controlador de usuarios";
            await checkFileExists(path.resolve(path.join(PATH_ASSIGNMENT, 'controllers', 'user')));
            this.msg_err = "No se incluye el controlador de sesiones";
            await checkFileExists(path.resolve(path.join(PATH_ASSIGNMENT, 'controllers', 'session')));
        });

        scored(`Comprobar que se ha añadido el código para incluir los comandos adecuados (P6)`, -1, async function () {
            let rawdata = fs.readFileSync(path.join(PATH_ASSIGNMENT, 'package.json'));
            let pack = JSON.parse(rawdata);
            this.msg_ok = 'Se incluyen todos los scripts/comandos';
            this.msg_err = 'No se han encontrado todos los scripts';
            scripts = {
                "super": "supervisor ./bin/www",
                "migrate": "sequelize db:migrate --url sqlite://$(pwd)/blog.sqlite",  
                "seed": "sequelize db:seed:all --url sqlite://$(pwd)/blog.sqlite",  
                "migrate_win": "sequelize db:migrate --url sqlite://%cd%/blog.sqlite",  
                "seed_win": "sequelize db:seed:all --url sqlite://%cd%/blog.sqlite"  ,
            };
            for(script in scripts){
                this.msg_err = `Falta el comando para ${script}`;
                pack.scripts[script].should.be.equal(scripts[script]);
            }
        });

    });

    describe("Tests funcionales", function () {
        var server;
        const db_filename = 'blog.sqlite';
        const db_file = path.resolve(path.join(ROOT, db_filename));

        const users = [
            {id: 1, username: "admin", email: "admin@core.example"},
            {id: 2, username: "pepe", email: "pepe@core.example"},
        ];

        before(async function() {
            if(has_failed()){
                return;
            }
            // Crear base de datos nueva y poblarla antes de los tests funcionales. por defecto, el servidor coge post.sqlite del CWD
            try {
                fs.unlinkSync(db_file);
                log('Previous test db removed. A new one is going to be created.')
            } catch {
                log('Previous test db does not exist. A new one is going to be created.')
            }
            fs.closeSync(fs.openSync(db_file, 'w'));

            let sequelize_cmd = path.join(PATH_ASSIGNMENT, "node_modules", ".bin", "sequelize")
            let db_url = `sqlite://${db_file}`;
            let db_relative_url = `sqlite://${db_filename}`;
            await exec(`${sequelize_cmd} db:migrate --url "${db_url}" --migrations-path ${path.join(PATH_ASSIGNMENT, "migrations")}`)
            log('Lanzada la migración');
            await exec(`${sequelize_cmd} db:seed:all --url "${db_url}" --seeders-path ${path.join(PATH_ASSIGNMENT, "seeders")}`)
            log('Lanzado el seeder');


            let bin_path = path.join(PATH_ASSIGNMENT, "bin", "www");
            server = spawn('node', [bin_path], {env: {PORT: TEST_PORT, DATABASE_URL: db_relative_url}});
            server.stdout.setEncoding('utf-8');
            server.stdout.on('data', function(data) {
                log('Salida del servidor: ', data);
            })
            server.stderr.on('data', function (data) {
                log('EL SERVIDOR HA DADO UN ERROR. SALIDA stderr: ' + data);
            });
            log(`Lanzado el servidor en el puerto ${TEST_PORT}`);
            await new Promise(resolve => setTimeout(resolve, TIMEOUT));
            browser.site = `http://localhost:${TEST_PORT}/`;
            try{
                await browser.visit("/");
                browser.assert.status(200);
            }catch(e){
                console.log("No se ha podido contactar con el servidor.");
                throw(e);
            }
        });

        after(async function() {
            // Borrar base de datos

            if(typeof server !== 'undefined') {
                await server.kill();
                function sleep(ms) {
                    return new Promise((resolve) => {
                        setTimeout(resolve, ms);
                    });
                }
                //wait for 1 second for the server to release the sqlite file
                await sleep(1000);
            }

            try {
                fs.unlinkSync(db_file);
            } catch(e){
                log("Test db not removed.");
                log(e);
            }
        });

        scored(`Se atienda la petición GET /users`, 1, async function () {
            this.msg_err = "La URL /users no está disponible";
            await browser.visit("/users");
            browser.assert.status(200);
            for (const usuario of users) {
                browser.html().includes(usuario.username).should.be.equal(true);
            }
        });

        scored(`La petición GET /users muestra todos los usuarios`, 1, async function () {
            await browser.visit(`/users`);
        });

        scored(`Se atiende la petición GET /users/:userId que muestra el usuario pedido, y su campo email`, 1, async function () {

            // Javascript is a pile of garbage
            for (const usuario of users) {
                this.msg_err = `No se encuentra el usuario "${usuario.username}" en los usuarios`;
                await browser.visit(`/users/${ usuario.id }`);
                this.msg_err = `La página del usuario "${usuario.username}" (/usuarios/${usuario.id}) no incluye el email correctamente`;
                //console.log("browser.html(): ", browser.html());
                browser.html().includes(usuario.email).should.be.equal(true);

            }
        })
        scored(`La peticion GET /users/:userId de un usuario inexistente informa de que no existe`, 0.5, async function() {
            try {
                await browser.visit(`/users/999`);
            } catch(e) {
                log(e);
            }
        });

        scored(`Se atiende la petición GET /users/new y muestra los campos del formulario new, incluido el de email`, 1, async function () {
            this.msg_err = 'No se muestra la página de creación';

            await browser.visit("/users/new");
            browser.assert.status(200);

            res = browser.html();
            this.msg_err = `No se encuentra el campo email en la página`;
            res.includes('email').should.be.equal(true);
        })

        scored(`Comprobar que NO se crea un nuevo usuario en la base de datos al mandar el formulario /users/new con los campos vacíos o repetidos`, 0.5, async function () {

            await browser.visit("/users/new");
            browser.assert.status(200);

            browser.assert.element('#email');
            await browser.pressButton('input[type=submit]');
            browser.assert.status(200);
            this.msg_err = `La página a la que ha redirigido el intento de creación de un usuario vacío no incluye el formulario de creación de un usuario`;
            log("POST CREADO. URL devuelta: " + browser.location.href);
            //check that the return page contains the form
            browser.assert.element('#email');
        });
        scored(`Comprobar que se crea un nuevo usuario en la base de datos al mandar el formulario /users/new`, 1.5, async function () {

            await browser.visit("/users/new");
            browser.assert.status(200);

            this.msg_err = `La página /users/new no incluye el formulario de creación de un user correcto`;
            browser.assert.element('#email');
            browser.assert.element('#username');
            browser.assert.element('#user_password');
            browser.assert.element('#user_confirm_password');
            browser.assert.element('input[type=submit]');
            await browser.fill('#email','prueba@core.example');
            await browser.fill('#username', 'prueba');
            await browser.fill('#user_password', 'prueba');
            await browser.fill('#user_confirm_password', 'prueba');
            await browser.pressButton('input[type=submit]');
            browser.assert.status(200);
            log("USER CREADO. URL devuelta: " + browser.location.href);
            this.msg_err = `El usuario nuevo no se muestra`;
            await browser.visit("/users/3");
        })


        scored(`Se atiende a la petición GET de /users/:userId/edit y muestra los campos bien rellenos`, 1, async function () {

            for (idx in users) {
                let user = users[idx];
                await browser.visit(`/users/${user.id}/edit`);
                this.msg_err = `La página del user "${user.title}" (/users/${user.id}) no parece permitir editar correctamente`;
                this.msg_err = `La página /users/${user.id}/edit no incluye alguno de los elementos del formulario`;
                browser.assert.element('#user_password');
                browser.assert.element('#email');
                browser.assert.element('input[type=submit]');
                this.msg_err = `La página /users/${user.id}/edit no incluye alguno de los elementos rellenos en el formulario`;
                browser.html().includes(user.email).should.be.equal(true);
                browser.html().includes(user.id).should.be.equal(true);
                browser.html().includes(user.username).should.be.equal(true);
            }
        });

        scored(`La petición PUT /users/:userId actualiza el usuario indicado`, 1.5, async function () {
            this.msg_err = 'No se muestra la página con los usuarios';
            //this time we don´t use user number 1 because it was edited in the previous test
            for (user of users) {
                this.msg_err = `La página del usuario "${user.username}" (/users/${user.id}) no parece permitir actualizaciones de contraseña`;
                let new_pass = `Prueba1234`;

                await browser.visit(`/users/${user.id}/edit`);
                await browser.fill('#user_password', new_pass);
                await browser.fill('#user_confirm_password', new_pass);

                await browser.pressButton('input[type=submit]');
                browser.assert.status(200)

                this.msg_err = `La página para "${user.username}" (/users/${user.id}) no muestra los cambios adecuados`;
                await browser.visit(`/users/${user.id}`);
                browser.assert.status(200)


                // Check that the new password works by logging in with it
                await browser.visit(`/login?_method=DELETE`);
                await browser.visit(`/login`);
                this.msg_err = `La nueva contraseña no funciona para hacer login.`;

                browser.assert.status(200)
                await browser.fill('#username', user.username);
                await browser.fill('#password', new_pass);
                await browser.pressButton('input[name=commit]');
                // It should not redirect to the login page
                log(browser.location.href);
                browser.location.href.includes("login").should.be.equal(false);
            }
        });

        scored(`La petición DELETE /users/:userId borra el usuario indicado`, 1, async function () {
            this.msg_err = 'No se muestra la página con los usuarios';
            //this time we don´t use user number 1 because it was edited in the previous test
            for (user of users) {
                if(user.username == 'admin') {
                    continue;
                }

                this.msg_err = `No se encuentra el user "${user.username}" en los users`;

                this.msg_err = `La página del usuario "${user.username}" (/users/${user.id}) no parece permitir borrar correctamente`;
                await browser.visit(`/users/${user.id}?_method=DELETE`);

                this.msg_err = `La página de users sigue mostrando "${user.username}" (/users/${user.id}) después de haber sido borrado`;
                await browser.visit("/users");
                browser.assert.status(200)
                res = browser.html();
                res.includes(user.username).should.be.equal(false);
            }
        });


    });

})
